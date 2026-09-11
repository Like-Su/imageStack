<script setup lang="ts">
import { RouterLink, useRoute } from "vue-router";

const route = useRoute();
</script>

<template>
  <nav
    class="mb-7 flex rounded-xl border border-line bg-panel2 p-1 text-[13.5px] font-semibold"
    :aria-label="$t('账户入口')"
  >
    <RouterLink
      v-for="tab in [
        { name: 'login', label: $t('登录') },
        { name: 'register', label: $t('注册') },
      ]"
      :key="tab.name"
      :to="{ name: tab.name, query: { redirect: route.query.redirect } }"
      class="flex-1 rounded-lg py-2 text-center transition-colors"
      :class="
        route.name === tab.name
          ? 'bg-panel3 text-ghost'
          : 'text-soft hover:text-ghost'
      "
    >
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>
