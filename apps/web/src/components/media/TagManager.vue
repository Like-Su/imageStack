<script setup lang="ts">
import { i18n, translate } from "@/i18n";
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  Plus,
  Tags,
  Users,
  Pencil,
  Merge,
  Trash2,
  SlidersHorizontal,
  Search,
  Sparkles,
} from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { PERSON_TAG_PREFIX } from "@/config/workspace";
import { useRemoteData } from "@/composables/useRemoteData";
import { updateTags } from "@/composables/workspaceUpdates";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Tag } from "@/types/media";
import PageHeader from "@/components/workspace/PageHeader.vue";
import DataState from "@/components/workspace/DataState.vue";
import AssetImage from "./AssetImage.vue";
import TagForm from "./TagForm.vue";
import TagMergeDialog from "./TagMergeDialog.vue";

const props = defineProps<{ people?: boolean }>();
const workspace = useWorkspaceStore();
const {
  data: tags,
  loading,
  error,
  refresh,
} = useRemoteData(mediaApi.tags, [], {
  resources: ["tags"],
  update: updateTags,
});
const text = ref("");
const managing = ref(false);
const formOpen = ref(false);
const editing = ref<Tag>();
const merging = ref<Tag>();
const deleting = ref(false);
const scoped = computed(() =>
  (tags.value ?? []).filter(
    (tag) => !props.people || tag.name.startsWith(PERSON_TAG_PREFIX),
  ),
);
const filtered = computed(() =>
  scoped.value
    .filter((tag) =>
      tag.name
        .toLocaleLowerCase()
        .includes(text.value.trim().toLocaleLowerCase()),
    )
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.name.localeCompare(right.name, i18n.global.locale.value),
    ),
);
function label(tag: Tag) {
  return props.people ? tag.name.slice(PERSON_TAG_PREFIX.length) : tag.name;
}
function edit(tag?: Tag) {
  editing.value = tag;
  formOpen.value = true;
}
async function remove(tag: Tag) {
  if (deleting.value) return;
  deleting.value = true;
  try {
    if (
      !(await workspace.confirm({
        title: translate("删除{value1}？", {
          value1: props.people ? translate("人物") : translate("标签"),
        }),
        message: translate("删除「{value1}」与全部关联，不会删除媒体文件。", {
          value1: label(tag),
        }),
        confirmLabel: translate("删除分组"),
        danger: true,
      }))
    )
      return;
    await workspace.perform(
      () => mediaApi.deleteTag(tag.id),
      translate("分组已删除，原文件已保留"),
      () => workspace.deleteTag(tag.id),
    );
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <section>
    <PageHeader
      :title="people ? $t('人物') : $t('标签')"
      :description="
        people
          ? $t('{value1} 位人物 · 按人整理，让重要的人更容易找到', {
              value1: scoped.length,
            })
          : $t('{value1} 个标签 · 为灵感建立自己的索引', {
              value1: scoped.length,
            })
      "
      ><el-button
        v-if="workspace.can('asset:tag')"
        native-type="button"
        :aria-pressed="managing"
        @click="managing = !managing"
      >
        <SlidersHorizontal />{{
          managing ? $t("完成管理") : $t("管理分组")
        }}</el-button
      ><el-button
        type="primary"
        native-type="button"
        :disabled="!workspace.can('asset:tag')"
        @click="edit()"
      >
        <Plus />{{ people ? $t("添加人物") : $t("新建标签") }}
      </el-button></PageHeader
    >
    <div class="px-4 sm:px-6">
      <div
        v-if="people"
        class="mh-gradient mb-5 flex gap-3 rounded-xl border border-line p-4"
      >
        <Sparkles class="mt-0.5 size-5 shrink-0 text-ai" />
        <p class="text-xs leading-6 text-soft">
          {{
            $t(
              "当前提供手动人物归类，可命名、关联媒体与合并同一人物。头像使用分组中的照片预览，不进行人脸裁剪；自动人脸识别模型尚未接入。",
            )
          }}
        </p>
      </div>
      <label
        class="mb-5 flex max-w-md items-center gap-2 rounded-lg border border-line bg-panel2 px-3"
        ><Search class="size-4 text-faint" /><input
          v-model="text"
          type="search"
          class="h-10 w-full bg-transparent text-xs outline-none"
          :aria-label="people ? $t('查找人物') : $t('查找标签')"
          :placeholder="people ? $t('查找人物…') : $t('查找标签…')"
      /></label>
      <DataState
        v-if="loading || error || !filtered.length"
        :loading="loading"
        :error="error"
        :icon="people ? Users : Tags"
        :title="
          text
            ? $t('没有找到匹配分组')
            : people
              ? $t('为照片里的重要人物命名')
              : $t('还没有标签')
        "
        :description="
          people
            ? $t('添加人物后，可从图库选择照片，或在详情中添加人物标签。')
            : $t('创建主题标签，或在媒体详情中直接添加。')
        "
        @retry="refresh"
        ><el-button
          type="primary"
          v-if="!text && workspace.can('asset:tag')"
          native-type="button"
          @click="edit()"
        >
          <Plus />{{ people ? $t("添加第一位人物") : $t("新建标签") }}
        </el-button></DataState
      >
      <div
        v-else
        :class="
          people
            ? 'grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
            : 'flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel p-5 sm:p-8'
        "
      >
        <article
          v-for="tag in filtered"
          :key="tag.id"
          :class="
            people
              ? 'min-w-0 text-center'
              : 'inline-flex max-w-full items-center gap-2 rounded-xl border border-line bg-panel2 px-4 py-3'
          "
        >
          <RouterLink
            :to="{
              name: people ? 'person-detail' : 'tag-detail',
              params: { id: tag.id },
            }"
            :class="
              people
                ? 'group block'
                : 'inline-flex min-w-0 items-center gap-2 hover:text-accent'
            "
          >
            <span
              v-if="people"
              class="mx-auto mb-3 block size-24 overflow-hidden rounded-full border-2 border-line bg-panel2 ring-accent/20 transition group-hover:border-accent group-hover:ring-4 xl:size-28"
              ><AssetImage
                v-if="tag.coverAssetId"
                :asset-id="tag.coverAssetId"
                :name="label(tag)" /><span
                v-else
                class="mh-gradient grid size-full place-items-center"
                ><Users class="size-8 text-ai/50" /></span
            ></span>
            <span
              :class="
                people
                  ? 'block truncate text-sm font-medium'
                  : 'truncate font-medium'
              "
              :style="
                !people
                  ? {
                      fontSize: `${Math.min(21, 12 + Math.log2(tag.count + 1))}px`,
                    }
                  : undefined
              "
              >{{ people ? "" : "#" }}{{ label(tag) }}</span
            ><span
              :class="
                people
                  ? 'mt-1 block text-[11px] text-faint'
                  : 'text-[10px] text-faint'
              "
              >{{ tag.count }}{{ people ? $t(" 项媒体") : "" }}</span
            >
          </RouterLink>
          <div
            v-if="managing && workspace.can('asset:tag')"
            class="flex shrink-0 justify-center gap-2 text-faint"
            :class="{ 'mt-3': people }"
          >
            <button
              type="button"
              class="hover:text-accent"
              :aria-label="$t('重命名 {value1}', { value1: label(tag) })"
              @click="edit(tag)"
            >
              <Pencil class="size-3.5" /></button
            ><button
              type="button"
              class="hover:text-ai"
              :aria-label="$t('合并 {value1}', { value1: label(tag) })"
              @click="merging = tag"
            >
              <Merge class="size-3.5" /></button
            ><button
              type="button"
              class="hover:text-err"
              :disabled="deleting"
              :aria-label="$t('删除 {value1}', { value1: label(tag) })"
              @click="remove(tag)"
            >
              <Trash2 class="size-3.5" />
            </button>
          </div>
        </article>
      </div>
    </div>
    <TagForm
      v-if="formOpen"
      :tag="editing"
      :people="people"
      @close="formOpen = false"
    />
    <TagMergeDialog
      v-if="merging"
      :tag="merging"
      @close="merging = undefined"
    />
  </section>
</template>
