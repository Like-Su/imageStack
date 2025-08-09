<script setup lang="ts">
import BaseChart from "@/components/BaseChart.vue"
import { ref } from "vue"

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
			data: [120, 200, 150, 80, 70, 110, 130],
		},
	],
})

// 分类占比（饼图）
const categoryOptions = ref({
	title: { text: "图片分类占比", left: "center" },
	tooltip: { trigger: "item" },
	legend: { bottom: "0%" },
	series: [
		{
			name: "分类",
			type: "pie",
			radius: "50%",
			data: [
				{ value: 1048, name: "风景" },
				{ value: 735, name: "人物" },
				{ value: 580, name: "美食" },
				{ value: 484, name: "建筑" },
				{ value: 300, name: "其他" },
			],
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
			data: [{ value: 65, name: "磁盘" }],
		},
	],
})
</script>

<template>
	<div class="p-4 grid grid-cols-2 gap-4">
		<!-- 上传趋势 -->
		<div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
			<BaseChart :options="uploadTrendOptions" />
		</div>

		<!-- 分类占比 -->
		<div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
			<BaseChart :options="categoryOptions" />
		</div>

		<!-- CPU 占用 -->
		<div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
			<BaseChart :options="cpuOptions" />
		</div>

		<!-- 磁盘占用 -->
		<div class="bg-white dark:bg-gray-800 p-4 rounded shadow">
			<BaseChart :options="diskOptions" />
		</div>
	</div>
</template>
