<script setup lang="ts">
// import { zhCN } from 'ant-design-vue';
const componentSize = "small"
</script>

<template>
  <a-config-provider :component-size="componentSize">
    <router-view></router-view>
  </a-config-provider>
</template>

<style lang="scss">
//@import "tailwindcss";
body,
#app {
  width: 100%;
  height: 100%;
}
</style>
