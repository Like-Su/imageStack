<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Copy, Link, Share2 } from "lucide-vue-next";
import { sharesApi } from "@/api/shares";
import { getErrorMessage } from "@/api/request";
import { useRemoteData } from "@/composables/useRemoteData";
import { formatDate } from "@/composables/mediaFormat";
import { translate } from "@/i18n";
import { useWorkspaceStore } from "@/stores/workspace";
import type { ShareLink, ShareTarget } from "@/types/shares";
import AppModal from "@/components/workspace/AppModal.vue";

const props = defineProps<{ target: ShareTarget; name: string }>();
const emit = defineEmits<{ close: [] }>();
const router = useRouter();
const workspace = useWorkspaceStore();
const {
  data: links,
  loading,
  error: loadError,
  refresh,
  mutate,
} = useRemoteData((signal) => sharesApi.list(props.target, signal));
const expiresInDays = ref(7);
const busy = ref(false);
const error = ref("");
const selectedLink = ref<ShareLink | null>(null);
const linkUrl = (link: ShareLink) =>
  new URL(router.resolve(link.path).href, window.location.origin).href;
const selectedUrl = computed(() =>
  selectedLink.value ? linkUrl(selectedLink.value) : "",
);
const active = (link: ShareLink) =>
  !link.revokedAt &&
  (!link.expiresAt || Date.parse(link.expiresAt) > Date.now());

async function create() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    selectedLink.value = await sharesApi.create(
      props.target,
      expiresInDays.value,
    );
    const created = selectedLink.value;
    mutate((current) =>
      [created, ...current.filter((link) => link.id !== created.id)].slice(
        0,
        50,
      ),
    );
  } catch (cause) {
    error.value = getErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}

async function copy(link: ShareLink) {
  selectedLink.value = link;
  try {
    await navigator.clipboard.writeText(linkUrl(link));
    workspace.notify(translate("分享链接已复制"));
    error.value = "";
  } catch {
    error.value = translate("自动复制失败，请选中链接手动复制");
  }
}

async function revoke(link: ShareLink) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await sharesApi.revoke(link.id);
    if (selectedLink.value?.id === link.id) selectedLink.value = null;
    workspace.notify(translate("分享已撤销"));
    const revokedAt = new Date().toISOString();
    mutate((current) =>
      current.map((entry) =>
        entry.id === link.id ? { ...entry, revokedAt } : entry,
      ),
    );
  } catch (cause) {
    error.value = getErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}

function selectLink(event: FocusEvent) {
  if (event.target instanceof HTMLInputElement) event.target.select();
}
</script>

<template>
  <AppModal
    open
    :title="$t('短链分享')"
    :description="name"
    :busy="busy"
    @update:open="!$event && emit('close')"
  >
    <div class="space-y-4 p-5">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        :title="
          $t(
            '持有链接的人可查看原图并登录保存，请勿分享私密内容。原图可能包含位置信息。',
          )
        "
      />
      <p class="text-xs leading-5 text-faint">
        {{
          $t(
            "相册仅分享其中的图片，最多 500 张。撤销或过期后无法继续访问，但不会删除对方已经保存的内容。",
          )
        }}
      </p>
      <el-form label-position="top" @submit.prevent="create">
        <el-form-item :label="$t('链接有效期')">
          <el-select
            v-model="expiresInDays"
            :disabled="busy"
            :aria-label="$t('链接有效期')"
          >
            <el-option
              v-for="days in [1, 7, 30, 0]"
              :key="days"
              :value="days"
              :label="
                days ? $t('{value1} 天', { value1: days }) : $t('永久有效')
              "
            />
          </el-select>
        </el-form-item>
        <el-button
          type="primary"
          native-type="submit"
          :loading="busy"
          class="w-full"
          ><Share2 />{{ $t("生成分享链接") }}</el-button
        >
      </el-form>
      <el-alert
        v-if="error || loadError"
        type="error"
        :closable="false"
        :title="error || loadError"
      />
      <div
        v-if="selectedLink"
        class="space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-3"
      >
        <el-input
          :model-value="selectedUrl"
          readonly
          :aria-label="$t('分享链接')"
          @focus="selectLink"
        />
        <el-button
          :icon="Copy"
          :disabled="busy || !active(selectedLink)"
          @click="copy(selectedLink)"
          >{{ $t("复制链接") }}</el-button
        >
      </div>
      <div class="flex items-center justify-between text-xs text-soft">
        <h3>{{ $t("最近的分享链接") }}</h3>
        <el-button
          text
          size="small"
          :loading="loading"
          :disabled="busy"
          @click="refresh"
          >{{ $t("刷新") }}</el-button
        >
      </div>
      <p v-if="!loading && !links?.length" class="text-xs text-faint">
        {{ $t("尚未创建分享链接") }}
      </p>
      <div
        v-for="link in links"
        :key="link.id"
        class="space-y-2 rounded-xl border border-line p-3 text-xs"
      >
        <div class="flex items-center gap-2">
          <Link class="size-4 shrink-0 text-accent" />
          <span class="min-w-0 truncate font-mono">{{ link.path }}</span>
          <el-tag
            class="ml-auto"
            size="small"
            :type="active(link) ? 'success' : 'info'"
            >{{
              link.revokedAt
                ? $t("已撤销")
                : active(link)
                  ? $t("有效")
                  : $t("已过期")
            }}</el-tag
          >
        </div>
        <p class="text-faint">
          {{
            link.expiresAt
              ? $t("有效期至 {value1}", { value1: formatDate(link.expiresAt) })
              : $t("永久有效")
          }}
        </p>
        <div class="flex gap-2">
          <el-button
            size="small"
            :disabled="busy || !active(link)"
            @click="copy(link)"
            >{{ $t("复制链接") }}</el-button
          >
          <el-popconfirm
            v-if="!link.revokedAt"
            :title="$t('撤销后此链接将无法访问，确定继续？')"
            :confirm-button-text="$t('撤销分享')"
            :cancel-button-text="$t('取消')"
            @confirm="revoke(link)"
          >
            <template #reference
              ><el-button size="small" type="danger" plain :disabled="busy">{{
                $t("撤销分享")
              }}</el-button></template
            >
          </el-popconfirm>
        </div>
      </div>
    </div>
  </AppModal>
</template>
