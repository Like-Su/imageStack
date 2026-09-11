<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { translate } from "@/i18n";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { Sparkles, Search, CircleHelp, Cpu } from "lucide-vue-next";
import { useWorkspaceStore } from "@/stores/workspace";
import PageHeader from "@/components/workspace/PageHeader.vue";
import AppModal from "@/components/workspace/AppModal.vue";
import DataState from "@/components/workspace/DataState.vue";
import AssetBrowser from "@/components/media/AssetBrowser.vue";
import ViewToggle from "@/components/media/ViewToggle.vue";
import AiIndexStatus from "@/components/media/AiIndexStatus.vue";

const route = useRoute();
const router = useRouter();
const workspace = useWorkspaceStore();
const query = computed(() =>
  typeof route.query.q === "string" ? route.query.q.trim() : "",
);
const text = ref(query.value);
const helpOpen = ref(false);
const suggestions = computed(() =>
  ["海边 日落", "猫", "产品 蓝色", "雪山", "截图", "旅行"].map((key) =>
    translate(key),
  ),
);
watch(query, (value) => {
  text.value = value;
});
function search(value = text.value) {
  if (!workspace.can("asset:search")) return;
  const next = value.trim();
  void router.push({ name: "search", query: next ? { q: next } : {} });
}
</script>

<template>
  <section>
    <PageHeader
      :title="$t('AI 智能搜索')"
      :description="$t('检索画面描述、图片文字、文件名和标签')"
      ><ViewToggle /><el-button
        text
        circle
        native-type="button"
        :aria-label="$t('搜索帮助')"
        @click="helpOpen = true"
      >
        <CircleHelp /></el-button
    ></PageHeader>
    <div
      class="mx-4 mb-5 rounded-2xl border border-line p-5 sm:mx-6 mh-gradient"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-ai">
          <Sparkles class="size-4" />{{ $t("找到你记忆中的画面") }}
        </h2>
        <span
          class="rounded-full border border-ai/20 bg-ai/10 px-2.5 py-1 text-[10px] text-ai"
          >{{ $t("AI 识图索引 + 关键词检索") }}</span
        >
      </div>
      <form class="mt-4 flex gap-2" @submit.prevent="search()">
        <el-input
          v-model="text"
          type="search"
          maxlength="200"
          class="!border-ai/20 !bg-ink/50"
          :aria-label="$t('画面内容、图片文字、文件名或标签关键词')"
          :placeholder="$t('例如：海边 日落，多个关键词以空格分隔')"
          :disabled="!workspace.can('asset:search')"
        /><el-button
          native-type="submit"
          class="!border-ai/30 !bg-ai/20 !text-ai"
          :disabled="!workspace.can('asset:search')"
        >
          <Search /><span class="hidden sm:inline">{{ $t("搜索") }}</span>
        </el-button>
      </form>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="suggestion in suggestions"
          :key="suggestion"
          type="button"
          class="rounded-full border border-ai/25 bg-ai/5 px-3 py-1.5 text-xs text-ghost transition hover:bg-ai/15"
          :disabled="!workspace.can('asset:search')"
          @click="search(suggestion)"
        >
          {{ suggestion }}
        </button>
      </div>
      <p class="mt-4 text-xs leading-6 text-soft">
        {{
          $t(
            "搜索匹配文件名、手动标签，以及已完成识图的画面描述、AI 关键词和识别文字。 空格分隔的关键词需全部匹配；未识图的旧图片可在下方补建索引，不展示虚构相似度。",
          )
        }}
      </p>
    </div>
    <AiIndexStatus v-if="workspace.can('asset:search')" />
    <div
      v-if="query"
      class="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6"
    >
      <p class="break-all text-sm text-soft">
        {{ $t("查询")
        }}<strong class="font-medium text-ghost">“{{ query }}”</strong>
      </p>
      <span class="flex items-center gap-1.5 text-[11px] text-ai"
        ><Cpu class="size-3.5" />{{ $t("图片内容与元数据检索") }}</span
      >
    </div>
    <DataState
      v-if="!workspace.can('asset:search')"
      :icon="Search"
      :title="$t('暂无搜索权限')"
      :description="$t('当前账户没有媒体搜索权限，请联系管理员。')"
    />
    <AssetBrowser
      v-else-if="query"
      :search="query"
      empty-title="没有找到匹配的媒体"
      empty-description="试试更短的画面关键词，或先补建 AI 图片索引；文件名和手动标签仍可搜索。"
    />
    <DataState
      v-else
      :icon="Search"
      :title="$t('记得一点线索，就从这里开始')"
      :description="
        $t('输入关键词，或点击示例查询；搜索结果均来自你的真实媒体库。')
      "
      ><RouterLink :to="{ name: 'plugins' }" class="mh-button"
        ><Sparkles />{{ $t("了解 AI 扩展能力") }}</RouterLink
      ></DataState
    >
    <AppModal v-model:open="helpOpen" :title="$t('搜索使用说明')"
      ><div class="space-y-3 p-5 text-sm leading-7 text-soft">
        <p>
          {{
            $t(
              "当前接口使用 keyword 模式，搜索你自己的未删除媒体，匹配文件名、手动标签和已完成的 AI 识图结果；例如「海边 日落」表示两个关键词都匹配，可以分别出现在描述或标签中。",
            )
          }}
        </p>
        <p>
          {{
            $t(
              "最多支持 200 个字符、16 个不同关键词。可以叠加上传 / 拍摄时间、图片类型、未分类或大文件筛选，结果按上传时间倒序。",
            )
          }}
        </p>
        <p>
          {{
            $t(
              "AI 识图会生成图片描述、关键词和清晰可辨的文字，可能存在误识别。新图片可自动识别，旧图片需手动补建；这会向已配置的服务发送压缩图片并可能产生费用。 当前不提供向量相似度检索，也不会自动识别人脸身份或理解整个视频。",
            )
          }}
        </p>
      </div></AppModal
    >
  </section>
</template>
