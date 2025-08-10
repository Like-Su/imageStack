import type { ApiResponse } from "@/api/response.ts"
import request from "./config/service.ts"

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
