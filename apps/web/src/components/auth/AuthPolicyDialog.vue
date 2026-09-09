<script setup lang="ts">
import { ref } from "vue";
import { X as CloseIcon } from "lucide-vue-next";

const dialog = ref<HTMLDialogElement | null>(null);
const documentType = ref<"terms" | "privacy">("terms");

function open(type: "terms" | "privacy") {
  documentType.value = type;
  dialog.value?.showModal();
}

defineExpose({ open });
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      aria-labelledby="policy-title"
      class="m-auto w-[calc(100%_-_32px)] max-w-lg rounded-2xl border border-line bg-panel p-6 text-ghost backdrop:bg-black/70"
    >
      <div class="mb-5 flex items-center justify-between gap-4">
        <h2 id="policy-title" class="text-lg font-semibold">
          {{ documentType === "terms" ? "服务条款" : "隐私政策" }}
        </h2>
        <button
          type="button"
          aria-label="关闭说明"
          class="rounded-lg p-1 text-soft hover:text-ghost"
          @click="dialog?.close()"
        >
          <CloseIcon class="size-5" aria-hidden="true" />
        </button>
      </div>
      <div
        v-if="documentType === 'terms'"
        class="space-y-3 text-sm leading-7 text-soft"
      >
        <p>
          本实例用于管理你拥有或已获授权的媒体资源。请勿上传违法内容，或侵犯他人的版权与隐私。
        </p>
        <p>
          请妥善保管账户密码，不向他人分享验证码或登录令牌；在公共设备上使用完毕后退出登录。
        </p>
        <p>
          实例的可用性、存储配额、数据备份及具体使用规则由部署管理员负责。如有疑问，请联系当前实例管理员。
        </p>
      </div>
      <div v-else class="space-y-3 text-sm leading-7 text-soft">
        <p>
          注册时提交的昵称、邮箱和密码将发送给当前实例的后端。后端以哈希形式保存密码，并使用配置的邮件服务发送账户邮件。
        </p>
        <p>
          登录后，浏览器会保存登录令牌及基本账户信息。勾选“保持登录状态”使用本地存储，否则仅保留在当前浏览器会话中。
        </p>
        <p>
          验证码图片来自当前实例；展示区沿用原型中的 Picsum
          示例图片，会向该图片服务发出请求，但不附带页面来源信息。
        </p>
        <p>
          媒体数据的存储、访问权限及删除策略以当前部署配置为准。请联系实例管理员了解适用的数据管理政策。
        </p>
      </div>
      <button type="button" class="auth-button mt-6" @click="dialog?.close()">
        我已了解
      </button>
    </dialog>
  </Teleport>
</template>
