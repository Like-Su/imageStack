<script setup lang="ts">
import * as echarts from "echarts"
import { onMounted, onBeforeUnmount, ref, watch } from "vue"

interface Props {
	options: echarts.EChartsOption
}

const props = defineProps<Props>()
const chartRef = ref<HTMLElement>()
let chartInstance: echarts.ECharts | null = null

const initChart = () => {
	if (chartRef.value) {
		chartInstance = echarts.init(chartRef.value)

		chartInstance.setOption(props.options)
		window.addEventListener("resize", resizeChart)
	}
}

const resizeChart = () => {
	chartInstance?.resize()
}

onMounted(() => {
	initChart()
})

onBeforeUnmount(() => {
	window.removeEventListener("resize", resizeChart)
	chartInstance?.dispose()
})

// 如果外部传入的 options 变化，更新图表
watch(
	() => props.options,
	(newOptions) => {
		chartInstance?.setOption(newOptions)
	},
	{ deep: true },
)
</script>

<template>
	<div ref="chartRef" style="width: 100%; height: 400px"></div>
</template>
