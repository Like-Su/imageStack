<script setup lang="ts">
import { Aperture } from "lucide-vue-next";
</script>

<template>
  <div class="flex items-center gap-2.5" aria-label="Media Hub">
    <span
      class="grid size-9 place-items-center rounded-xl bg-accent text-[#0d0f12] shadow-[0_6px_20px_-6px_rgba(255,106,69,0.7)]"
    >
      <Aperture class="size-5" aria-hidden="true" />
    </span>
    <span class="font-display text-[15px] font-bold tracking-tight"
      >Media Hub</span
    >
  </div>
</template>
