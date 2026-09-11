<script setup lang="ts">
import { ref } from "vue";
import AppModal from "@/components/workspace/AppModal.vue";

const visible = ref(false);
const documentType = ref<"terms" | "privacy">("terms");

function open(type: "terms" | "privacy") {
  documentType.value = type;
  visible.value = true;
}

defineExpose({ open });
</script>

<template>
  <AppModal
    v-model:open="visible"
    :title="documentType === 'terms' ? $t('服务条款') : $t('隐私政策')"
  >
    <div class="p-5">
      <div
        v-if="documentType === 'terms'"
        class="space-y-3 text-sm leading-7 text-soft"
      >
        <p>
          {{
            $t(
              "本实例用于管理你拥有或已获授权的媒体资源。请勿上传违法内容，或侵犯他人的版权与隐私。",
            )
          }}
        </p>
        <p>
          {{
            $t(
              "请妥善保管账户密码，不向他人分享验证码或登录令牌；在公共设备上使用完毕后退出登录。",
            )
          }}
        </p>
        <p>
          {{
            $t(
              "实例的可用性、存储配额、数据备份及具体使用规则由部署管理员负责。如有疑问，请联系当前实例管理员。",
            )
          }}
        </p>
      </div>
      <div v-else class="space-y-3 text-sm leading-7 text-soft">
        <p>
          {{
            $t(
              "注册时提交的昵称、邮箱和密码将发送给当前实例的后端。后端以哈希形式保存密码，并使用配置的邮件服务发送账户邮件。",
            )
          }}
        </p>
        <p>
          {{
            $t(
              "登录后，浏览器会保存登录令牌及基本账户信息。勾选“保持登录状态”使用本地存储，否则仅保留在当前浏览器会话中。",
            )
          }}
        </p>
        <p>
          {{
            $t(
              "验证码图片来自当前实例；展示区沿用原型中的 Picsum 示例图片，会向该图片服务发出请求，但不附带页面来源信息。",
            )
          }}
        </p>
        <p>
          {{
            $t(
              "媒体数据的存储、访问权限及删除策略以当前部署配置为准。请联系实例管理员了解适用的数据管理政策。",
            )
          }}
        </p>
      </div>
      <el-button type="primary" class="mt-6 w-full" @click="visible = false">{{
        $t("我已了解")
      }}</el-button>
    </div>
  </AppModal>
</template>
