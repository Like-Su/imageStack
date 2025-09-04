<template>
	<div
		ref="container"
		class="vm-wrapper"
		@scroll="onScroll"
		@dragenter.prevent="onDragEnter"
		@dragover.prevent="onDragOver"
		@dragleave.prevent="onDragLeave"
		@drop.prevent="onDrop"
	>
		<!-- 占位区域（在可见内容上方留出空间） -->
		<div :style="{ height: topPadding + 'px' }"></div>

		<!-- 可见图片 -->
		<div class="grid-container">
			<div
				v-for="item in visibleItems"
				:key="item.id"
				class="vm-item cursor-pointer"
				@click="openDetail(item.id)"
			>
				<img :src="item.uri" :alt="item.name" class="vm-img" loading="lazy" />
			</div>
		</div>

		<!-- 占位区域（在可见内容下方留出空间） -->
		<div :style="{ height: bottomPadding + 'px' }"></div>

		<div v-if="allItems.length === 0 && !loading" class="loading">暂无数据</div>
		<div v-if="loading" class="loading">加载中...</div>
		<div v-if="finished && allItems.length > 0" class="loading">没有更多了</div>

		<!-- 拖拽遮罩层 -->
		<div v-if="isDragOver" class="drag-overlay">
			<div class="overlay-content">📁 拖拽图片到这里上传</div>
		</div>

		<!-- 详情弹窗 -->
		<a-modal
			v-model:open="showDetail"
			title="编辑图片信息"
			:confirm-loading="submitting"
			:footer="null"
			width="500px"
		>
			<img
				:src="detailForm.uri"
				alt=""
				style="width: 100%; margin-bottom: 16px"
			/>
			<a-form
				:model="detailForm"
				:label-col="{ span: 5 }"
				:wrapper-col="{ span: 19 }"
			>
				<a-form-item label="图片名称">
					<a-input v-model:value="detailForm.name" disabled />
				</a-form-item>

				<a-form-item label="描述">
					<a-textarea v-model:value="detailForm.description" :rows="3" />
				</a-form-item>

				<a-form-item label="状态">
					<span>{{ detailForm.status === 2 ? "正常" : "回收站" }}</span>
				</a-form-item>

				<!-- 标签编辑 -->
				<a-form-item label="标签">
					<div class="tag-list">
						<a-tag
							v-for="(tag, index) in detailForm.tags"
							:key="tag.id || tag.name"
							closable
							@close="removeTag(index)"
						>
							{{ tag.name }}
						</a-tag>

						<a-input
							v-if="inputVisible"
							ref="inputRef"
							type="text"
							size="small"
							v-model:value="inputValue"
							@blur="handleInputConfirm"
							@keyup.enter="handleInputConfirm"
							style="width: 100px"
						/>
						<a-tag v-else @click="showInput" style="borderstyle: dashed">
							<plus-outlined /> 新增标签
						</a-tag>
					</div>
				</a-form-item>
			</a-form>

			<div class="modal-footer">
				<div class="w-[40%] flex justify-between">
					<a-button type="primary" @click="download(detailForm.id)"
						>下载</a-button
					>
					<a-button type="primary" @click="handleSubmit" :loading="submitting"
						>保存</a-button
					>
					<a-button @click="closeDetail">取消</a-button>
				</div>
				<a-button
					type="primary"
					danger
					@click="handleDelete(detailForm.id)"
					style="float: right"
				>
					删除
				</a-button>
			</div>
		</a-modal>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, nextTick } from "vue"
import {
	getListImages,
	updateImage,
	downloadImage,
	uploadImage,
	uploadImageByUrl,
	uploadConfirm,
	deleteImage,
	createTag,
} from "@/api/pictures"
import { message } from "ant-design-vue"
import { useHead } from "@vueuse/head"

// === 虚拟列表参数 ===
const COLS = 4
const ITEM_HEIGHT = 220
const BUFFER_ROWS = 3

// === 数据 ===
const allItems = reactive<any[]>([])
const page = ref(1)
const limit = 20
const container = ref<HTMLElement | null>(null)

// 滚动状态
const scrollTop = ref(0)
const containerHeight = ref(0)

// 加载状态
const loading = ref(false)
const finished = ref(false)

// 拖拽上传状态
const isDragOver = ref(false)

// === 虚拟滚动计算 ===
function onScroll() {
	if (!container.value) return
	scrollTop.value = container.value.scrollTop
	containerHeight.value = container.value.clientHeight

	const scrollBottom =
		container.value.scrollHeight -
		(container.value.scrollTop + container.value.clientHeight)

	if (scrollBottom < ITEM_HEIGHT * 3) {
		loadImages()
	}
}
const totalRows = computed(() => Math.ceil(allItems.length / COLS))
const startRow = computed(() =>
	Math.max(Math.floor(scrollTop.value / ITEM_HEIGHT) - BUFFER_ROWS, 0),
)
const endRow = computed(() =>
	Math.min(
		Math.ceil((scrollTop.value + containerHeight.value) / ITEM_HEIGHT) +
			BUFFER_ROWS,
		totalRows.value,
	),
)
const visibleItems = computed(() => {
	const startIndex = startRow.value * COLS
	const endIndex = endRow.value * COLS
	return allItems.slice(startIndex, endIndex)
})
const topPadding = computed(() => startRow.value * ITEM_HEIGHT)
const bottomPadding = computed(
	() => (totalRows.value - endRow.value) * ITEM_HEIGHT,
)

// === 图片加载 ===
async function loadImages() {
	if (loading.value || finished.value) return
	loading.value = true
	try {
		const res = await getListImages(limit, page.value)
		if (res?.data?.length) {
			allItems.push(...res.data)
			page.value++
		} else {
			finished.value = true
		}
	} finally {
		loading.value = false
	}
}

// === 拖拽上传 ===
function onDragEnter() {
	isDragOver.value = true
}
function onDragOver() {
	isDragOver.value = true
}
function onDragLeave(e: DragEvent) {
	if (
		e.relatedTarget === null ||
		!container.value?.contains(e.relatedTarget as Node)
	) {
		isDragOver.value = false
	}
}
async function onDrop(e: DragEvent) {
	isDragOver.value = false
	const files = Array.from(e.dataTransfer?.files || []).filter((file) =>
		file.type.startsWith("image/"),
	)
	if (!files.length) {
		message.warning("请拖入图片文件")
		return
	}
	try {
		const uploaded = []
		for (const file of files) {
			const uploadRes = await uploadImage(file.name)
			if (!uploadRes.data) throw new Error()
			const { uploadInfo, url } = uploadRes.data
			uploadInfo.originname = file.name
			await uploadImageByUrl(url, file)
			uploaded.push(uploadInfo)
		}
		await uploadConfirm(uploaded)
		message.success("上传成功")
		page.value = 1
		allItems.length = 0
		finished.value = false
		loadImages()
	} catch {
		message.error("上传失败")
	}
}

// === 详情操作 ===
const showDetail = ref(false)
const submitting = ref(false)
const detailForm = reactive({
	id: 0,
	name: "",
	description: "",
	status: 0,
	uri: "",
	tags: [] as { id: number; name: string }[], // 标签字段
})

// 打开详情
function openDetail(id: number) {
	const item = allItems.find((img) => img.id === id)
	if (item) {
		Object.assign(detailForm, {
			id: item.id ?? 0,
			name: item.name ?? "",
			description: item.description ?? "",
			status: item.status ?? 0,
			uri: item.uri ?? "",
			tags: Array.isArray(item.tags) ? item.tags : [],
		})
		showDetail.value = true
	}
}

// === 标签编辑逻辑 ===
const inputVisible = ref(false)
const inputValue = ref("")
const inputRef = ref()

function showInput() {
	inputVisible.value = true
	nextTick(() => inputRef.value?.focus())
}

async function handleInputConfirm() {
	if (!inputValue.value) {
		inputVisible.value = false
		return
	}

	if (detailForm.tags.some((t) => t.name === inputValue.value)) {
		message.warning("标签已存在")
	} else {
		try {
			const { data } = await createTag(inputValue.value)
			detailForm.tags.push(
				...data.identifiers.map((item) => ({
					id: item.id,
					name: inputValue.value,
				})),
			)
			message.success("标签已创建")
		} catch {
			message.error("创建标签失败")
		}
	}
	inputVisible.value = false
	inputValue.value = ""
}

function removeTag(index: number) {
	detailForm.tags.splice(index, 1)
}

// === 提交保存 ===
async function handleSubmit() {
	submitting.value = true
	try {
		const tags = detailForm.tags.map((t) => t.id)
		console.log(tags)
		await updateImage(
			detailForm.id,
			detailForm.description,
			tags,
			detailForm.status,
		)
		message.success("图片信息已更新")
		const index = allItems.findIndex((i) => i.id === detailForm.id)
		if (index !== -1) Object.assign(allItems[index], detailForm)
		showDetail.value = false
	} catch {
		message.error("更新失败")
	} finally {
		submitting.value = false
	}
}

async function handleDelete(id: number) {
	try {
		await deleteImage(id)
		allItems.splice(
			allItems.findIndex((i) => i.id === id),
			1,
		)
		showDetail.value = false
		message.success("删除成功")
	} catch {
		message.error("删除失败, 请重试")
	}
}
const download = async (id: number) => await downloadImage(id)
function closeDetail() {
	showDetail.value = false
}

onMounted(() => {
	if (container.value) {
		containerHeight.value = container.value.clientHeight
	}
	loadImages()
})

useHead({
	title: "图片管理 | ImageStack",
})
</script>

<style scoped>
/* 保留已有样式 */
.vm-wrapper {
	height: 88vh;
	overflow-y: auto;
	padding: 8px;
	box-sizing: border-box;
	-ms-overflow-style: none;
	scrollbar-width: none;
}
.vm-wrapper::-webkit-scrollbar {
	display: none;
}
.grid-container {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 8px;
}
.vm-item {
	height: 220px;
	border-radius: 8px;
	overflow: hidden;
	background: #f7f7f7;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.vm-img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}
.loading {
	text-align: center;
	padding: 12px;
	color: #666;
	font-size: 14px;
}
.modal-footer {
	margin-top: 16px;
	display: flex;
	justify-content: space-between;
	gap: 8px;
}
.drag-overlay {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: rgba(0, 0, 0, 0.45);
	backdrop-filter: blur(8px);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 9999;
	animation: fadeIn 0.25s ease-out;
}
.overlay-content {
	padding: 40px 60px;
	border: 3px dashed rgba(255, 255, 255, 0.7);
	border-radius: 20px;
	background: linear-gradient(
		145deg,
		rgba(255, 255, 255, 0.15),
		rgba(255, 255, 255, 0.05)
	);
	color: #fff;
	font-size: 1.3rem;
	font-weight: 600;
	text-align: center;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
	animation: pulse 1.5s infinite;
	backdrop-filter: blur(12px);
}
@keyframes fadeIn {
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}
@keyframes pulse {
	0%,
	100% {
		transform: scale(1);
		border-color: rgba(255, 255, 255, 0.6);
	}
	50% {
		transform: scale(1.05);
		border-color: rgba(255, 255, 255, 0.9);
	}
}
.tag-list {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	align-items: center;
}
</style>
