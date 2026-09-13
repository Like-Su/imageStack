<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type {
  FormInstance,
  FormRules,
  UploadFile,
  UploadInstance,
} from "element-plus";
import { getErrorMessage } from "@/api/request";
import { prepareProfileAvatar } from "@/composables/profileAvatar";
import { translate } from "@/i18n";
import { useAuthStore } from "@/stores/auth";
import { useWorkspaceStore } from "@/stores/workspace";
import AppModal from "./AppModal.vue";

const emit = defineEmits<{ close: [] }>();
const auth = useAuthStore();
const workspace = useWorkspaceStore();
const sessionVersion = auth.getSessionVersion();
const initialName = auth.user?.username ?? "";
const initialAvatar = auth.user?.avatar ?? null;
const draft = reactive({ username: initialName, avatar: initialAvatar });
const form = ref<FormInstance>();
const upload = ref<UploadInstance>();
const saving = ref(false);
const preparing = ref(false);
const error = ref("");
const busy = computed(() => saving.value || preparing.value);
const changed = computed(
  () => draft.username.trim() !== initialName || draft.avatar !== initialAvatar,
);
const rules = computed<FormRules>(() => ({
  username: [
    {
      trigger: "blur",
      validator: (_rule, value: string, callback) => {
        const length = value.trim().length;
        callback(
          length >= 1 && length <= 80
            ? undefined
            : new Error(translate("昵称需为 1–80 个字符")),
        );
      },
    },
  ],
}));

async function chooseAvatar(file: UploadFile) {
  if (!file.raw || busy.value) return;
  preparing.value = true;
  error.value = "";
  try {
    draft.avatar = await prepareProfileAvatar(file.raw);
  } catch (cause) {
    error.value = getErrorMessage(cause);
  } finally {
    preparing.value = false;
    upload.value?.clearFiles();
  }
}

async function submit() {
  if (busy.value || !changed.value) return;
  saving.value = true;
  error.value = "";
  try {
    if (!(await form.value?.validate().catch(() => false))) return;
    if (sessionVersion !== auth.getSessionVersion()) {
      error.value = translate("登录状态已变化，请重试");
      return;
    }
    await auth.updateProfile({
      username: draft.username.trim(),
      ...(draft.avatar !== initialAvatar ? { avatar: draft.avatar } : {}),
    });
    workspace.notify(translate("个人资料已更新"));
    emit("close");
  } catch (cause) {
    error.value = getErrorMessage(cause);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AppModal
    open
    :title="$t('编辑个人资料')"
    :busy="busy"
    @update:open="!$event && emit('close')"
  >
    <el-form
      ref="form"
      :model="draft"
      :rules="rules"
      :disabled="busy"
      label-position="top"
      class="p-5"
      @submit.prevent="submit"
    >
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        show-icon
        class="mb-4"
      />
      <el-form-item :label="$t('昵称')" prop="username">
        <el-input
          v-model="draft.username"
          :maxlength="80"
          show-word-limit
          autocomplete="nickname"
          :placeholder="$t('请输入昵称')"
        />
      </el-form-item>
      <el-form-item :label="$t('头像')">
        <div class="flex flex-wrap items-center gap-3">
          <el-avatar :size="64" :src="draft.avatar ?? ''" :alt="$t('头像')">
            {{ draft.username.trim().slice(0, 1).toUpperCase() || $t("我") }}
          </el-avatar>
          <el-upload
            ref="upload"
            accept="image/jpeg,image/png,image/webp"
            :auto-upload="false"
            :show-file-list="false"
            :disabled="busy"
            :on-change="chooseAvatar"
          >
            <el-button native-type="button" :loading="preparing">{{
              $t("选择头像")
            }}</el-button>
          </el-upload>
          <el-button
            native-type="button"
            :disabled="busy || !draft.avatar"
            @click="draft.avatar = null"
            >{{ $t("移除头像") }}</el-button
          >
        </div>
        <p class="mt-2 w-full text-xs leading-5 text-faint">
          {{
            $t(
              "支持 PNG、JPEG、WebP，最大 5 MiB；自动居中裁剪并压缩，保存后生效。",
            )
          }}
        </p>
      </el-form-item>
      <el-form-item :label="$t('邮箱')">
        <el-input
          :model-value="auth.user?.email ?? ''"
          readonly
          aria-describedby="profile-security-note"
        />
      </el-form-item>
      <p id="profile-security-note" class="mb-5 text-xs leading-5 text-faint">
        {{ $t("邮箱用于登录，如需修改请联系管理员；角色和权限不能在此修改。") }}
      </p>
      <div class="flex justify-end gap-2">
        <el-button
          native-type="button"
          :disabled="busy"
          @click="emit('close')"
          >{{ $t("取消") }}</el-button
        >
        <el-button
          type="primary"
          native-type="submit"
          :loading="saving"
          :disabled="busy || !changed"
          >{{ $t("保存更改") }}</el-button
        >
      </div>
    </el-form>
  </AppModal>
</template>
