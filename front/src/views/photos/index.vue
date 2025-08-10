<template>
	<div ref="container" class="vm-wrapper" @scroll="onScroll">
		<div class="vm-columns" :style="{ columnGap: gap + 'px' }">
			<div v-for="item in allItems" :key="item.id" class="vm-item">
				<img :src="item.uri" :alt="item.name" loading="lazy" class="vm-img" />
				<div class="vm-caption">{{ item.description || item.name }}</div>
			</div>
		</div>
		<div v-if="loading" class="loading">加载中...</div>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue"
import { getListImages } from "@/api/pictures"

const gap = 8
const minColumnWidth = 240

const container = ref<HTMLElement | null>(null)
const allItems = reactive([])

const page = ref(1)
const limit = 20
const loading = ref(false)

async function loadImages() {
	if (loading.value) return
	loading.value = true
	try {
		const res = await getListImages(limit, page.value)
		if (res?.data?.length) {
			allItems.push(...res.data)
			page.value++
		}
	} finally {
		loading.value = false
	}
}

function onScroll() {
	if (!container.value || loading.value) return
	const scrollBottom =
		container.value.scrollTop + container.value.clientHeight >=
		container.value.scrollHeight - 200
	if (scrollBottom) {
		loadImages()
	}
}

onMounted(() => {
	loadImages()
})
</script>

<style scoped>
.vm-wrapper {
	height: 88vh;
	overflow-y: scroll; /* 依然允许滚动 */
	padding: 8px;
	box-sizing: border-box;

	/* 适配所有浏览器的隐藏滚动条方案 */
	-ms-overflow-style: none; /* IE 和 Edge */
	scrollbar-width: none; /* Firefox */
}
.vm-wrapper::-webkit-scrollbar {
	display: none; /* Chrome、Safari 和 Opera */
}

.vm-columns {
	column-width: 240px;
	column-gap: 8px;
}
.vm-item {
	break-inside: avoid;
	margin-bottom: 8px;
	border-radius: 8px;
	overflow: hidden;
	background: #f7f7f7;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.vm-img {
	width: 100%;
	height: auto;
	display: block;
}
.vm-caption {
	padding: 8px;
	font-size: 13px;
}
.loading {
	text-align: center;
	padding: 16px;
	color: #666;
	background: white;
}
</style>
