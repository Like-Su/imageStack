import type { ApiResponse } from "@/api/response.ts"
import request from "./config/service.ts"

interface Trend {
	date: string
	count: number
}

export const trend = async (): Promise<ApiResponse<Trend[]>> => {
	return await request.get("/api/picture/trend")
}

export const getDiskInfo = async (diskName = "D") => {
	return await request.get("/api/system/disk_info", {
		params: {
			dir_name: diskName,
		},
	})
}
