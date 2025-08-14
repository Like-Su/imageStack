<template>
	<div ref="container" class="vm-wrapper" @scroll="onScroll">
		<div class="vm-columns" :style="{ columnGap: gap + 'px' }">
			<!-- 已加载的图片 -->
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

		<!-- 详情弹窗（Ant Design Vue Modal + Form） -->
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
					<a-textarea
						v-model:value="detailForm.description"
						:rows="3"
						placeholder="请输入图片描述"
					/>
				</a-form-item>

				<a-form-item label="状态">
					<span>{{ detailForm.status === 2 ? "正常" : "回收站" }}</span>
				</a-form-item>
			</a-form>
			<div class="modal-footer">
				<div class="w-[40%] flex justify-between">
					<a-button type="primary" @click="download(detailForm.id)">
						下载
					</a-button>

					<a-button type="primary" @click="handleSubmit" :loading="submitting">
						保存
					</a-button>

					<a-button type="default" @click="closeDetail"> 取消 </a-button>
				</div>
				<a-button
					type="primary"
					danger
					@click="handleDelete"
					style="float: right"
				>
					删除
				</a-button>
			</div>
		</a-modal>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue"
import { getListImages, updateImage, downloadImage } from "@/api/pictures"
import { useSettingStore } from "@/stores/settings.ts"
import { message } from "ant-design-vue"

const useSettings = useSettingStore()
const gap = 8
const container = ref<HTMLElement | null>(null)
const allItems = reactive<any[]>([])

const page = ref(1)
const limit = 20

// 弹窗和表单数据
const showDetail = ref(false)
const submitting = ref(false)
const detailForm = reactive({
	id: 0,
	name: "",
	description: "",
	status: 0,
	uri: "",
})

async function loadImages() {
	try {
		const res = await getListImages(limit, page.value)
		if (res?.data?.length) {
			allItems.push(...res.data)
			page.value++
		}
	} finally {
	}
}

function onScroll() {
	if (!container.value) return
	const scrollBottom =
		container.value.scrollTop + container.value.clientHeight >=
		container.value.scrollHeight - 200
	if (scrollBottom) {
		loadImages()
	}
}

// 点击图片打开弹窗
function openDetail(id: number) {
	const item = allItems.find((img) => img.id === id)
	if (item) {
		detailForm.id = item.id
		detailForm.name = item.name
		detailForm.description = item.description || ""
		detailForm.status = item.status ?? 0
		detailForm.uri = item.uri
		showDetail.value = true
	}
}

// 提交更新
async function handleSubmit() {
	submitting.value = true
	try {
		await updateImage(detailForm.id, detailForm.description, detailForm.status)
		message.success("图片信息已更新")
		// 同步更新到本地数组
		const index = allItems.findIndex((i) => i.id === detailForm.id)
		if (index !== -1) {
			allItems[index].description = detailForm.description
			allItems[index].status = detailForm.status
		}
		showDetail.value = false
	} catch (e) {
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
	height: auto;
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
</style>
