<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { Sparkles, Search, CircleHelp, Cpu } from "lucide-vue-next";
import { useWorkspaceStore } from "@/stores/workspace";
import PageHeader from "@/components/workspace/PageHeader.vue";
import AppModal from "@/components/workspace/AppModal.vue";
import DataState from "@/components/workspace/DataState.vue";
import AssetBrowser from "@/components/media/AssetBrowser.vue";
import ViewToggle from "@/components/media/ViewToggle.vue";

const route = useRoute();
const router = useRouter();
const workspace = useWorkspaceStore();
const query = computed(() =>
  typeof route.query.q === "string" ? route.query.q.trim() : "",
);
const text = ref(query.value);
const helpOpen = ref(false);
const suggestions = ["海边 日落", "猫", "产品 蓝色", "雪山", "截图", "旅行"];
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
      title="AI 智能搜索"
      description="从文件名与标签中发现关联，让每一次寻找更简单"
      ><ViewToggle /><button
        type="button"
        class="mh-icon-button"
        aria-label="搜索帮助"
        @click="helpOpen = true"
      >
        <CircleHelp /></button
    ></PageHeader>
    <div
      class="mx-4 mb-5 rounded-2xl border border-line p-5 sm:mx-6 mh-gradient"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-ai">
          <Sparkles class="size-4" />找到你记忆中的画面
        </h2>
        <span
          class="rounded-full border border-ai/20 bg-ai/10 px-2.5 py-1 text-[10px] text-ai"
          >当前：关键词检索</span
        >
      </div>
      <form class="mt-4 flex gap-2" @submit.prevent="search()">
        <input
          v-model="text"
          type="search"
          maxlength="200"
          class="mh-input !border-ai/20 !bg-ink/50"
          aria-label="文件名或标签关键词"
          placeholder="例如：海边 日落，多个关键词以空格分隔"
          :disabled="!workspace.can('asset:search')"
        /><button
          type="submit"
          class="mh-button !border-ai/30 !bg-ai/20 !text-ai"
          :disabled="!workspace.can('asset:search')"
        >
          <Search /><span class="hidden sm:inline">搜索</span>
        </button>
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
        搜索匹配文件名和手动标签；空格分隔的关键词需全部匹配。自然语言语义、OCR
        与向量检索模型尚未接入，不展示模拟相似度。
      </p>
    </div>
    <div
      v-if="query"
      class="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6"
    >
      <p class="break-all text-sm text-soft">
        查询 <strong class="font-medium text-ghost">“{{ query }}”</strong>
      </p>
      <span class="flex items-center gap-1.5 text-[11px] text-ai"
        ><Cpu class="size-3.5" />数据库关键词检索</span
      >
    </div>
    <DataState
      v-if="!workspace.can('asset:search')"
      :icon="Search"
      title="暂无搜索权限"
      description="当前账户没有媒体搜索权限，请联系管理员。"
    />
    <AssetBrowser
      v-else-if="query"
      :search="query"
      empty-title="没有找到匹配的媒体"
      empty-description="试试更短的文件名关键词，或先为照片添加对应标签。"
    />
    <DataState
      v-else
      :icon="Search"
      title="记得一点线索，就从这里开始"
      description="输入关键词，或点击示例查询；搜索结果均来自你的真实媒体库。"
      ><RouterLink :to="{ name: 'plugins' }" class="mh-button"
        ><Sparkles />了解 AI 扩展能力</RouterLink
      ></DataState
    >
    <AppModal v-model:open="helpOpen" title="搜索使用说明"
      ><div class="space-y-3 p-5 text-sm leading-7 text-soft">
        <p>
          当前接口使用 keyword
          模式，搜索你自己的未删除图片，匹配文件名与手动标签；例如「海边
          日落」表示两个关键词都匹配。
        </p>
        <p>
          最多支持 200 个字符、16 个不同关键词。可以叠加上传 /
          拍摄时间、图片类型、未分类或大文件筛选，结果按上传时间倒序。
        </p>
        <p>
          标签、人物分组中的名称同样可搜索。语义模型和 OCR
          尚未接入，因此不会理解未记录在文件名或标签中的画面内容。
        </p>
      </div></AppModal
    >
  </section>
</template>
