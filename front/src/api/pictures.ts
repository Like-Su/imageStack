import type { ApiResponse } from "@/api/response.ts"
import request from "./config/service.ts"
import type { SEARCH_TYPE } from "@/constants.ts"

interface Picture {
	id: number
	name: string
	description: string
	uri: string
	size: number
	status: number
	createTime: string
	updateTime: string
}

export const getListImages = async (
	limit?: number,
	page?: number,
): ApiResponse<Picture[]> => {
	return await request.get("/api/picture/list_image", {
		params: { limit, page },
	})
}

export const updateImage = async (
	imageId: number,
	description: string,
	tags: number[],
	status: number,
) => {
	return await request.post("/api/picture/update_image", {
		image_id: imageId,
		tags,
		description,
		status,
	})
}

export const downloadImage = (id: number) => {
	return request.get(`/api/picture/download`, {
		params: { id },
		responseType: "blob",
	})
}

export const uploadImage = (fileName: string) => {
	return request.get("/api/picture/upload", {
		params: {
			file_name: fileName,
		},
	})
}

export const uploadImageByUrl = async (url: string, file: File) => {
	return await request.put(url, file)
}

export const uploadConfirm = async (uploadInfos: any) => {
	return await request.post("/api/picture/upload/confirm", {
		pictures: uploadInfos,
	})
}

export const deleteImage = async (id: number) => {
	return await request.post("/api/picture/delete", { image_id: id })
}

export const recycleList = async () => {
	return await request.get("/api/picture/recycle")
}

export const recycleDelete = async (id: number) => {
	return await request.post("/api/picture/recycle/delete", { image_id: id })
}

export const recycleRestore = async (id: number) => {
	return await request.post("/api/picture/recycle/restore", { image_id: id })
}

export const search = async (keyword: string, type: SEARCH_TYPE) => {
	return await request.get("/api/picture/search", {
		params: { keyword, type },
	})
}

export const createTag = async (name: string) => {
	return await request.post("/api/picture/create_tag", { name })
}

export const getTagList = async () => {
	return await request.get("/api/picture/tag_list")
}

export const deleteTag = async (id: number) => {
	return await request.post("/api/picture/remove_tag", { tag_id: id })
}

export const updateTag = async (id: number, name: string) => {
	return await request.post("/api/picture/update_tag", { id, name })
}
