<script setup lang="ts">
import { Star } from "lucide-vue-next";
import { useWorkspaceStore } from "@/stores/workspace";
import PageHeader from "@/components/workspace/PageHeader.vue";
import AssetBrowser from "@/components/media/AssetBrowser.vue";
import ViewToggle from "@/components/media/ViewToggle.vue";
const workspace = useWorkspaceStore();
</script>

<template>
  <section>
    <PageHeader
      :title="$t('收藏')"
      :description="
        $t('{value1}为喜欢的瞬间留一个专属位置', {
          value1: workspace.overview
            ? $t('{value1} 项收藏 · ', { value1: workspace.overview.favorites })
            : '',
        })
      "
      ><Star
        class="mr-1 size-4 fill-accent/20 text-accent" /><ViewToggle /></PageHeader
    ><AssetBrowser
      :query="{ favorite: true }"
      empty-title="把喜欢的瞬间收藏起来"
      empty-description="点击图片右上角的星标，收藏的媒体会显示在这里。"
    />
  </section>
</template>
