<script setup lang="ts">
import { ref, reactive, onMounted } from "vue"
import { message, Modal } from "ant-design-vue"
import { getTagList, createTag, updateTag, deleteTag } from "@/api/pictures" // 需要你自己实现 API
interface Tag {
	id: number
	name: string
	owner_id: number
}

// === 状态管理 ===
const loading = ref(false)
const tags = ref<Tag[]>([])
const pagination = reactive({
	current: 1,
	pageSize: 10,
	total: 0,
})

const searchText = ref("")

// === 新增 tag ===
const addModalVisible = ref(false)
const newTagName = ref("")

// === 获取标签列表 ===
async function fetchTags() {
	loading.value = true
	try {
		const res = await getTagList({
			page: pagination.current,
			limit: pagination.pageSize,
			search: searchText.value,
		})
		tags.value = res.data || []
		pagination.total = res.total || 0
	} finally {
		loading.value = false
	}
}

// === 搜索 ===
function handleSearch() {
	pagination.current = 1
	fetchTags()
}

// === 新增 ===
async function handleAddTag() {
	if (!newTagName.value.trim()) {
		return message.warning("请输入标签名")
	}
	try {
		await createTag(newTagName.value.trim())
		message.success("标签已添加")
		addModalVisible.value = false
		newTagName.value = ""
		fetchTags()
	} catch {
		message.error("添加失败")
	}
}

// === 编辑 ===
async function handleEdit(tag: Tag, newName: string) {
	if (!newName.trim()) return
	try {
		await updateTag(tag.id, newName.trim())
		message.success("标签已更新")
		fetchTags()
	} catch {
		message.error("更新失败")
	}
}

// === 删除 ===
function confirmDelete(tag: Tag) {
	Modal.confirm({
		title: "确认删除该标签？",
		content: `标签名：${tag.name}`,
		okText: "删除",
		cancelText: "取消",
		okType: "danger",
		async onOk() {
			try {
				await deleteTag(tag.id)
				message.success("删除成功")
				fetchTags()
			} catch {
				message.error("删除失败")
			}
		},
	})
}

onMounted(fetchTags)
</script>

<template>
	<div class="tag-page">
		<div class="toolbar">
			<a-input-search
				v-model:value="searchText"
				placeholder="搜索标签"
				enter-button
				@search="handleSearch"
				style="max-width: 240px"
			/>
			<a-button type="primary" @click="addModalVisible = true"
				>新增标签</a-button
			>
		</div>

		<a-table
			:data-source="tags"
			:loading="loading"
			:pagination="{
				current: pagination.current,
				pageSize: pagination.pageSize,
				total: pagination.total,
				showTotal: (total) => `共 ${total} 条`,
				showSizeChanger: true,
			}"
			@change="
				(p) => {
					pagination.current = p.current
					pagination.pageSize = p.pageSize
					fetchTags()
				}
			"
			row-key="id"
			bordered
		>
			<a-table-column title="ID" dataIndex="id" key="id" width="80" />
			<a-table-column title="标签名" key="name">
				<template #default="{ record }">
					<a-input
						v-model:value="record.name"
						@pressEnter="handleEdit(record, record.name)"
						@blur="handleEdit(record, record.name)"
					/>
				</template>
			</a-table-column>
			<a-table-column title="操作" key="action" width="120">
				<template #default="{ record }">
					<a-button danger type="link" @click="confirmDelete(record)"
						>删除</a-button
					>
				</template>
			</a-table-column>
		</a-table>

		<!-- 新增弹窗 -->
		<a-modal
			v-model:open="addModalVisible"
			title="新增标签"
			ok-text="确定"
			cancel-text="取消"
			@ok="handleAddTag"
		>
			<a-input
				v-model:value="newTagName"
				placeholder="请输入标签名"
				@pressEnter="handleAddTag"
			/>
		</a-modal>
	</div>
</template>

<style scoped lang="scss">
.tag-page {
	padding: 16px;

	.toolbar {
		display: flex;
		justify-content: space-between;
		margin-bottom: 16px;
		gap: 12px;
	}
}
</style>
