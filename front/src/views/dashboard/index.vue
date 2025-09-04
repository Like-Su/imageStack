<script setup lang="ts">
import BaseChart from "@/components/BaseChart.vue"
import { computed, ref, watch } from "vue"
import { trend, getDiskInfo } from "@/api/dashboard"
import { useHead } from "@vueuse/head"
import { useSettingStore } from "@/stores/settings.ts"

const trendCount = ref(Array.from(7).fill(0))
const diskInfo = ref({})
const usage = ref(0)
onMounted(async () => {
	trendCount.value = (await trend()).data.map((date) => date.count)
	diskInfo.value = (await getDiskInfo()).data[0]
	usage.value = parseFloat(diskInfo.value?.usage) || 0
})

const useSettings = useSettingStore()

// 上传趋势（折线图）
const uploadTrendOptions = ref({
	title: { text: "图片上传趋势" },
	tooltip: { trigger: "axis" },
	xAxis: {
		type: "category",
		data: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
	},
	yAxis: { type: "value" },
	series: [
		{
			name: "上传量",
			type: "line",
			smooth: true,
			data: trendCount,
		},
	],
})

// CPU 占用（仪表盘）
const cpuOptions = ref({
	title: { text: "CPU 占用率", left: "center" },
	series: [
		{
			type: "gauge",
			progress: { show: true },
			detail: { valueAnimation: true, formatter: "{value}%" },
			data: [{ value: 35, name: "CPU" }],
		},
	],
})

// 磁盘占用（仪表盘）
const diskOptions = ref({
	title: { text: "磁盘使用率", left: "center" },
	series: [
		{
			type: "gauge",
			progress: { show: true },
			detail: { valueAnimation: true, formatter: "{value}%" },
			data: [{ value: usage, name: "磁盘" }],
		},
	],
})

useHead({
	title: "首页 | ImageStack",
})
</script>

<template>
	<div class="p-4 grid grid-cols-2 gap-4">
		<!-- 上传趋势 -->
		<div class="p-4 rounded shadow" :class="useSettings.globalBgClass">
			<BaseChart :options="uploadTrendOptions" />
		</div>

		<!-- CPU 占用 -->
		<div class="p-4 rounded shadow" :class="useSettings.globalBgClass">
			<BaseChart :options="cpuOptions" />
		</div>

		<!-- 磁盘占用 -->
		<div class="p-4 rounded shadow" :class="useSettings.globalBgClass">
			<BaseChart :options="diskOptions" />
		</div>
	</div>
</template>
