<script setup lang="ts">
import { onMounted, ref } from "vue"
import { recycleList, recycleDelete, recycleRestore } from "@/api/pictures"
import { message, Modal } from "ant-design-vue"
import dayjs from "dayjs"
import { useHead } from "@vueuse/head"

const recycles = ref([]) // 回收站数据
const loading = ref(false)

const fetchRecycleList = async (id?: number) => {
	loading.value = true
	try {
		if (id) {
			recycles.value = recycles.value.filter((item) => item.id !== id)
			return
		}
		recycles.value = (await recycleList()).data
	} finally {
		loading.value = false
	}
}

const handleDelete = (id: number) => {
	Modal.confirm({
		title: "确定要删除该图片吗？",
		content: "删除后将无法恢复。",
		okText: "删除",
		okType: "danger",
		cancelText: "取消",
		async onOk() {
			await recycleDelete(id)
			message.success("删除成功")
			fetchRecycleList(id)
		},
	})
}

const handleRestore = async (id: number) => {
	await recycleRestore(id)
	message.success("恢复成功")
	fetchRecycleList()
}

onMounted(() => {
	fetchRecycleList()
})

// 表格列配置
const columns = [
	{
		title: "图片",
		dataIndex: "url",
		key: "url",
		customRender: ({ record }) => {
			const { uri } = record
			return h("img", {
				src: uri,
				style:
					"width: 60px; height: 60px; object-fit: cover; border-radius: 4px; margin: 0 auto;",
			})
		},
	},
	{
		title: "名称",
		dataIndex: "name",
		key: "name",
	},
	{
		title: "删除时间",
		dataIndex: "updateTime",
		key: "updateTime",
		customRender: ({ record }) => {
			const { updateTime } = record
			const date = dayjs(updateTime).format("YYYY-MM-DD HH:mm:ss")
			return h(
				"time",
				{
					datetime: date,
				},
				date,
			)
		},
	},
	{
		title: "操作",
		key: "action",
		customRender: ({ record }) => {
			return [
				h(
					"a",
					{
						style: "margin-right: 12px; color: #52c41a; cursor: pointer;",
						onClick: () => handleRestore(record.id),
					},
					"恢复",
				),
				h(
					"a",
					{
						style: "color: #ff4d4f; cursor: pointer;",
						onClick: () => handleDelete(record.id),
					},
					"删除",
				),
			]
		},
	},
]

useHead({
	title: "回收站 | ImageStack",
})
</script>

<template>
	<a-table
		:columns="columns"
		:data-source="recycles"
		:loading="loading"
		row-key="id"
		bordered
	/>
</template>

<style scoped lang="scss"></style>
