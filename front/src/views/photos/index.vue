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
		<div class="vm-columns" :style="{ columnGap: gap + 'px' }">
			<div
				v-for="item in allItems"
				:key="item.id"
				class="vm-item cursor-pointer"
				@click="openDetail(item.id)"
			>
				<img :src="item.uri" :alt="item.name" loading="lazy" class="vm-img" />
			</div>
		</div>

		<div v-if="allItems.length === 0" class="loading">暂无数据</div>

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
					@click="handleDelete"
					style="float: right"
					>删除</a-button
				>
			</div>
		</a-modal>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue"
import { getListImages, updateImage, downloadImage } from "@/api/pictures"
import { message } from "ant-design-vue"

const gap = 8
const container = ref<HTMLElement | null>(null)
const allItems = reactive<any[]>([])

const page = ref(1)
const limit = 20
const isDragOver = ref(false)

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
		for (const file of files) {
			await uploadImage(file) // 你自己的上传 API
		}
		message.success("上传成功")
		page.value = 1
		allItems.length = 0
		loadImages()
	} catch {
		message.error("上传失败")
	}
}

async function loadImages() {
	const res = await getListImages(limit, page.value)
	if (res?.data?.length) {
		allItems.push(...res.data)
		page.value++
	}
}

function onScroll() {
	if (!container.value) return
	if (
		container.value.scrollTop + container.value.clientHeight >=
		container.value.scrollHeight - 200
	) {
		loadImages()
	}
}

function openDetail(id: number) {
	const item = allItems.find((img) => img.id === id)
	if (item) {
		Object.assign(detailForm, item)
		showDetail.value = true
	}
}

const showDetail = ref(false)
const submitting = ref(false)
const detailForm = reactive({
	id: 0,
	name: "",
	description: "",
	status: 0,
	uri: "",
})

async function handleSubmit() {
	submitting.value = true
	try {
		await updateImage(detailForm.id, detailForm.description, detailForm.status)
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

const handleDelete = () => {}
const download = async (id: number) => await downloadImage(id)
function closeDetail() {
	showDetail.value = false
}

onMounted(() => {
	loadImages()
})
</script>

<style scoped>
.vm-wrapper {
	height: 88vh;
	overflow-y: scroll;
	padding: 8px;
	box-sizing: border-box;
	-ms-overflow-style: none;
	scrollbar-width: none;
}
.vm-wrapper::-webkit-scrollbar {
	display: none;
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
	display: block;
	object-fit: contain;
	user-select: none;
}
.modal-footer {
	margin-top: 16px;
	display: flex;
	justify-content: space-between;
	gap: 8px;
}

/* 遮罩层样式 */
/* 遮罩层样式 */
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
</style>
