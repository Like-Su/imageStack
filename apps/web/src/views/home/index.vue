<script setup lang="ts">
import { computed } from "vue";
import { ArrowDownWideNarrow } from "lucide-vue-next";
import { useWorkspaceStore } from "@/stores/workspace";
import PageHeader from "@/components/workspace/PageHeader.vue";
import AssetBrowser from "@/components/media/AssetBrowser.vue";
import ViewToggle from "@/components/media/ViewToggle.vue";
const workspace = useWorkspaceStore();
const description = computed(
  () =>
    `${workspace.overview ? `${workspace.overview.total.toLocaleString()} 项媒体 · ` : ""}你的回忆与灵感，都在这里`,
);
</script>

<template>
  <section>
    <PageHeader title="图库" :description="description"
      ><ViewToggle /><span class="mh-button !cursor-default"
        ><ArrowDownWideNarrow />最新上传优先</span
      ></PageHeader
    ><AssetBrowser />
  </section>
</template>
