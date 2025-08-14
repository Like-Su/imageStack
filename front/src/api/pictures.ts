import type { ApiResponse } from "@/api/response.ts"
import request from "./config/service.ts"
import { PICTURE_STATUS } from "../../../src/constants.ts"

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
	status: number,
) => {
	return await request.post("/api/picture/update_image", {
		image_id: imageId,
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
