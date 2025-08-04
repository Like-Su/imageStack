import type { ApiResponse } from "@/api/response.ts"
import request from "./config/service.ts"

interface Permission {
  id: number
  code: number
  description: number
}

export interface User {
  email: string
  password: string
  // captcha: string;
}

export interface UserInfo {
  id: number
  email: string
  nickanme: string
  picture: string
  status: number
  permissions: Permission[]
  roles: string[]
  createTime: number
  updateTime: number
}
interface TokenResponse {
  access_token: string
  refresh_token: string
}
export interface UserResponse extends TokenResponse {
  userInfo: UserInfo
}

export const login = async (user: User): ApiResponse<UserResponse> => {
  return await request.post("/api/user/login", user)
}

export const refreshToken = async (
  refreshToken: string,
): ApiResponse<TokenResponse> => {
  // const token =
  // "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7InVzZXJJZCI6MX0sImlhdCI6MTc1NDI4MDU5MCwiZXhwIjoxNzU0MjgwNjUwfQ.AIbBfh7Rb3uNeWgTGRzuIERLrotpa2D7mZfdJ-x6_8s"
  return await request.get("/api/user/refresh", {
    params: {
      refresh_token: refreshToken,
    },
  })
}
