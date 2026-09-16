<script setup lang="ts">
import { translate } from "@/i18n";
import { computed } from "vue";
import { useWorkspaceStore } from "@/stores/workspace";
import PageHeader from "@/components/workspace/PageHeader.vue";
import AssetBrowser from "@/components/media/AssetBrowser.vue";
import ViewToggle from "@/components/media/ViewToggle.vue";
const workspace = useWorkspaceStore();
const description = computed(() =>
  translate("{value1}你的回忆与灵感，都在这里", {
    value1: workspace.overview
      ? translate("{value1} 项媒体 · ", {
          value1: workspace.overview.total.toLocaleString(),
        })
      : "",
  }),
);
</script>

<template>
  <section>
    <PageHeader :title="$t('图库')" :description="description">
      <ViewToggle />
    </PageHeader>
    <AssetBrowser />
  </section>
</template>
