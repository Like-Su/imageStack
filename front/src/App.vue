<script setup lang="ts">
import { provide } from "vue"
import { message } from "ant-design-vue"
import Emitter from "@/emitter.ts"
import { MESSAGE_EMITTER } from "@/constants.ts"

type MessageType = "success" | "error" | "info" | "warning"
const messageEmitter = new Emitter<MessageType>()

messageEmitter.on("success", message.success)
messageEmitter.on("error", message.error)
messageEmitter.on("info", message.info)
messageEmitter.on("warning", message.warning)

provide(MESSAGE_EMITTER, messageEmitter)

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
