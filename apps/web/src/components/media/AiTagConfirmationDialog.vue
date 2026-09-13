<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref } from "vue";
import { Plus, RefreshCw, X as RemoveIcon } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { invalidateCollectionCache } from "@/api/collectionCache";
import { getErrorMessage, requestScope } from "@/api/request";
import { useRemoteData } from "@/composables/useRemoteData";
import { updateTags } from "@/composables/workspaceUpdates";
import { translate } from "@/i18n";
import { useWorkspaceStore } from "@/stores/workspace";
import type { ConfirmAssetTagsInput } from "@/types/media";
import AppModal from "@/components/workspace/AppModal.vue";
import DataState from "@/components/workspace/DataState.vue";

const props = defineProps<{ assetId: string; keywords: string[] }>();
const emit = defineEmits<{ close: [] }>();
const workspace = useWorkspaceStore();
const {
  data: tags,
  loading,
  error: loadError,
  refresh,
} = useRemoteData(mediaApi.tags, [], {
  resources: ["tags"],
  update: updateTags,
});
const suggestedNames = new Set(
  props.keywords.map((name) => name.trim()).filter(Boolean),
);
let nextCandidateId = 0;
const candidates = ref(
  [...suggestedNames].slice(0, 50).map((name) => ({
    id: nextCandidateId++,
    name,
  })),
);
const mode = ref<ConfirmAssetTagsInput["mode"]>("create");
const candidateList = ref<HTMLDivElement | null>(null);
const tagsByName = computed(
  () => new Map((tags.value ?? []).map((tag) => [tag.name, tag])),
);
const tagsById = computed(
  () => new Map((tags.value ?? []).map((tag) => [tag.id, tag])),
);
const candidateNames = computed(() => [
  ...new Set(
    candidates.value.map((candidate) => candidate.name.trim()).filter(Boolean),
  ),
]);
const unmatchedCount = computed(
  () =>
    candidateNames.value.filter((name) => !tagsByName.value.has(name)).length,
);

const assignment = computed<ConfirmAssetTagsInput>(() => {
  const tagIds = new Set<string>();
  const names: string[] = [];
  for (const name of candidateNames.value) {
    const tag = tagsByName.value.get(name);
    if (tag) tagIds.add(tag.id);
    else if (mode.value === "create") names.push(name);
  }
  return { mode: mode.value, names, tagIds: [...tagIds] };
});
const selected = computed({
  get: () => assignment.value.tagIds,
  set: (tagIds: string[]) => {
    const selectedIds = new Set(tagIds);
    const nextCandidates = candidates.value.filter((candidate) => {
      const tag = tagsByName.value.get(candidate.name.trim());
      return !tag || selectedIds.has(tag.id);
    });
    const names = new Set(
      nextCandidates.map((candidate) => candidate.name.trim()),
    );
    for (const tagId of selectedIds) {
      if (nextCandidates.length >= 50) break;
      const tag = tagsById.value.get(tagId);
      if (!tag || names.has(tag.name)) continue;
      nextCandidates.push({ id: nextCandidateId++, name: tag.name });
      names.add(tag.name);
    }
    candidates.value = nextCandidates;
  },
});
const total = computed(
  () => assignment.value.names.length + assignment.value.tagIds.length,
);
const tagOptions = computed(() => {
  const selectedIds = new Set(selected.value);
  return (tags.value ?? []).map((tag) => ({
    label: tag.name,
    value: tag.id,
    disabled: candidates.value.length >= 50 && !selectedIds.has(tag.id),
  }));
});
const busy = ref(false);
const error = ref("");
const controller = new AbortController();
const scope = requestScope();

onScopeDispose(() => controller.abort());

function isCurrent() {
  return !controller.signal.aborted && scope === requestScope();
}

async function addCandidate() {
  if (busy.value || candidates.value.length >= 50) return;
  candidates.value.push({ id: nextCandidateId++, name: "" });
  await nextTick();
  candidateList.value?.lastElementChild?.querySelector("input")?.focus();
}

function removeCandidate(candidateId: number) {
  if (busy.value) return;
  candidates.value = candidates.value.filter(
    (candidate) => candidate.id !== candidateId,
  );
}

async function reloadTags() {
  if (busy.value) return;
  invalidateCollectionCache(["tags"]);
  await refresh();
}

async function submit() {
  if (
    busy.value ||
    loading.value ||
    loadError.value ||
    !tags.value ||
    !isCurrent() ||
    !workspace.can("asset:tag")
  )
    return;
  error.value = "";
  if (total.value < 1 || total.value > 50) {
    error.value = translate("请确认 1～50 个标签");
    return;
  }
  if (
    candidates.value.some((candidate) => {
      const name = candidate.name.trim();
      return !name || name.length > 100 || name.includes("\0");
    })
  ) {
    error.value = translate("标签名称须为 1～100 个字符，且不能包含空字符。");
    return;
  }
  busy.value = true;
  try {
    const result = await mediaApi.confirmTags(
      props.assetId,
      assignment.value,
      controller.signal,
    );
    if (!isCurrent()) return;
    workspace.applyTagBatch(result);
    workspace.notify(
      translate("标签已保存，新增 {value1} 个标签", {
        value1: result.createdCount,
      }),
    );
    emit("close");
  } catch (cause) {
    if (isCurrent()) error.value = getErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AppModal
    open
    :title="$t('编辑 AI 标签')"
    :description="
      $t('可先增加、修改或删除 AI 候选标签，确认保存前不会写入标签表。')
    "
    :busy="busy"
    @update:open="emit('close')"
  >
    <form class="space-y-4 p-5" @submit.prevent="submit">
      <el-radio-group v-model="mode" :disabled="busy">
        <el-radio-button value="create">{{
          $t("允许新建标签")
        }}</el-radio-button>
        <el-radio-button value="existing">{{
          $t("仅使用已有标签")
        }}</el-radio-button>
      </el-radio-group>
      <DataState
        v-if="(loading && !tags) || loadError"
        :loading="loading"
        :error="loadError"
        @retry="reloadTags"
      />
      <template v-else-if="tags">
        <p v-if="mode === 'existing'" class="text-xs leading-6 text-soft">
          {{
            $t(
              "仅关联与候选名称匹配的已有标签；未匹配的候选不会保存，也不会创建新标签。",
            )
          }}
        </p>
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h5 class="text-xs font-semibold text-main">
              {{ $t("候选标签") }}
            </h5>
            <span class="text-xs text-faint">{{ candidates.length }} / 50</span>
          </div>
          <p class="text-xs leading-6 text-soft">
            {{
              $t(
                "直接修改名称，点击「添加候选标签」新增，点击「删除」移除；同名标签自动复用，重复名称自动去重。",
              )
            }}
          </p>
          <p v-if="!candidates.length" class="text-xs leading-6 text-faint">
            {{ $t("还没有候选标签，请添加候选或选择已有标签。") }}
          </p>
          <div
            ref="candidateList"
            class="max-h-64 space-y-2 overflow-y-auto pr-1"
          >
            <div
              v-for="candidate in candidates"
              :key="candidate.id"
              class="flex items-center gap-2"
            >
              <el-input
                v-model="candidate.name"
                class="min-w-0 flex-1"
                maxlength="100"
                required
                :disabled="busy"
                :placeholder="$t('候选标签名称')"
                :aria-label="$t('候选标签名称')"
              />
              <span
                v-if="candidate.name.trim()"
                class="shrink-0 text-[10px]"
                :class="
                  tagsByName.has(candidate.name.trim())
                    ? 'text-accent'
                    : mode === 'create'
                      ? 'text-ai'
                      : 'text-warn'
                "
              >
                {{
                  tagsByName.has(candidate.name.trim())
                    ? $t("复用已有")
                    : mode === "create"
                      ? $t("待新建")
                      : $t("不会保存")
                }}
              </span>
              <el-button
                text
                type="danger"
                class="shrink-0"
                native-type="button"
                :disabled="busy"
                :aria-label="
                  $t('移除候选标签 {value1}', { value1: candidate.name })
                "
                @click="removeCandidate(candidate.id)"
              >
                <RemoveIcon />{{ $t("删除") }}
              </el-button>
            </div>
          </div>
          <el-button
            native-type="button"
            :disabled="busy || candidates.length >= 50"
            @click="addCandidate"
          >
            <Plus />{{ $t("添加候选标签") }}
          </el-button>
        </div>
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <label for="ai-existing-tags" class="text-xs text-soft">{{
              $t("选择已有标签")
            }}</label>
            <el-button
              text
              circle
              native-type="button"
              :disabled="busy || loading"
              :aria-label="$t('刷新标签列表')"
              @click="reloadTags"
            >
              <RefreshCw :class="{ 'animate-spin': loading }" />
            </el-button>
          </div>
          <el-select-v2
            id="ai-existing-tags"
            v-model="selected"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            :multiple-limit="50"
            :options="tagOptions"
            class="w-full"
            :disabled="busy || loading || !tags.length"
            :placeholder="$t('搜索并选择已有标签')"
          />
          <p class="text-xs leading-6 text-faint">
            {{ $t("已有标签选择与候选列表同步；取消选中会移除对应候选。") }}
          </p>
          <p v-if="!tags.length" class="text-xs leading-6 text-faint">
            {{ $t("还没有可用标签，可选择允许新建标签。") }}
          </p>
        </div>
        <div
          class="rounded-lg border border-line bg-panel2 p-3 text-xs leading-6"
          aria-live="polite"
        >
          <p>
            {{
              $t(
                "将关联 {value1} 个标签，其中新建 {value2} 个、复用 {value3} 个。",
                {
                  value1: total,
                  value2: assignment.names.length,
                  value3: assignment.tagIds.length,
                },
              )
            }}
          </p>
          <p v-if="mode === 'existing' && unmatchedCount" class="text-warn">
            {{
              $t(
                "{value1} 个候选未匹配已有标签，不会保存；可改为已有名称，或选择「允许新建标签」。",
                {
                  value1: unmatchedCount,
                },
              )
            }}
          </p>
          <p class="text-faint">
            {{
              $t(
                "仅新增关联，不移除媒体原有标签；编辑候选不会修改或删除已有标签。",
              )
            }}
          </p>
        </div>
        <p v-if="total > 50" class="text-xs text-err" role="alert">
          {{ $t("请确认 1～50 个标签") }}
        </p>
      </template>
      <p v-if="error" class="text-xs leading-6 text-err" role="alert">
        {{ error }}
      </p>
      <div class="flex justify-end gap-2">
        <el-button
          native-type="button"
          :disabled="busy"
          @click="emit('close')"
          >{{ $t("取消") }}</el-button
        >
        <el-button
          type="primary"
          native-type="submit"
          :loading="busy"
          :disabled="
            busy ||
            loading ||
            Boolean(loadError) ||
            !tags ||
            total < 1 ||
            total > 50
          "
        >
          {{ $t("确认保存标签") }}
        </el-button>
      </div>
    </form>
  </AppModal>
</template>
