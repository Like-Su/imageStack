<script setup lang="ts">
import { translate } from "@/i18n";
import { computed, nextTick, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import {
  Monitor,
  Moon,
  Sun,
  Palette,
  Settings2,
  HardDrive,
  ShieldCheck,
  UserRound,
  KeyRound,
  LogOut,
  RotateCcw,
  Puzzle,
} from "lucide-vue-next";
import { systemApi } from "@/api/system";
import { useRemoteData } from "@/composables/useRemoteData";
import { useTheme, type ThemeMode } from "@/composables/useTheme";
import { formatBytes } from "@/composables/mediaFormat";
import { useAuthStore } from "@/stores/auth";
import { usePreferencesStore } from "@/stores/preferences";
import { useUploadsStore } from "@/stores/uploads";
import { useWorkspaceStore } from "@/stores/workspace";
import PageHeader from "@/components/workspace/PageHeader.vue";
import SettingRow from "@/components/workspace/SettingRow.vue";
import LocaleSwitcher from "@/components/LocaleSwitcher.vue";

const auth = useAuthStore();
const workspace = useWorkspaceStore();
const preferences = usePreferencesStore();
const uploads = useUploadsStore();
const route = useRoute();
const router = useRouter();
const { currentTheme, setTheme } = useTheme();
const {
  data: capabilities,
  error: capabilitiesError,
  refresh,
} = useRemoteData(systemApi.capabilities);
const accountSection = ref<HTMLElement | null>(null);
const signingOut = ref<"current" | "all" | null>(null);
const themeOptions = [
  { value: "dark", label: "深色", icon: Moon },
  { value: "light", label: "浅色", icon: Sun },
  { value: "system", label: "跟随系统", icon: Monitor },
] as const;
const builtin = computed(
  () =>
    new Set(
      capabilities.value?.extensions
        .filter((extension) => extension.builtin)
        .map((extension) => extension.id) ?? [],
    ),
);

watch(
  () => route.hash,
  async (hash) => {
    await nextTick();
    if (hash === "#account")
      accountSection.value?.scrollIntoView({ block: "start" });
  },
  { immediate: true, flush: "post" },
);
function changeTheme(theme: ThemeMode) {
  if (!setTheme(theme))
    workspace.notify(
      translate("主题已切换，但浏览器无法保存，刷新后可能恢复默认。"),
      "info",
    );
}
async function resetPreferences() {
  if (
    !(await workspace.confirm({
      title: translate("恢复默认显示设置？"),
      message: translate(
        "只重置本账户在此浏览器中的显示偏好和主题，不会删除照片或修改服务器配置。",
      ),
      confirmLabel: translate("恢复默认"),
    }))
  )
    return;
  preferences.reset();
  changeTheme("dark");
  workspace.notify(translate("已恢复默认显示设置"));
}
async function logout(allDevices = false) {
  if (signingOut.value) return;
  if (allDevices || uploads.active) {
    const description = [
      allDevices
        ? translate("将撤销当前账户在所有设备上的登录会话。")
        : translate("将退出当前设备。"),
      uploads.active
        ? translate(
            "仍有上传未完成，退出会停止本机请求；服务器可能已经接收部分文件。",
          )
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    if (
      !(await workspace.confirm({
        title: allDevices
          ? translate("退出所有设备？")
          : translate("确认退出？"),
        message: description,
        confirmLabel: translate("退出登录"),
        danger: true,
      }))
    )
      return;
  }
  signingOut.value = allDevices ? "all" : "current";
  let status = allDevices ? "signed-out-all" : "signed-out";
  try {
    await auth.logout(allDevices);
  } catch {
    status = "local-sign-out";
  } finally {
    signingOut.value = null;
    await router.replace({ name: "login", query: { status } });
  }
}
</script>

<template>
  <section>
    <PageHeader
      :title="$t('设置')"
      :description="$t('让媒体库更适合你的使用习惯')"
      ><el-button native-type="button" @click="resetPreferences">
        <RotateCcw />{{ $t("恢复显示默认值") }}</el-button
      ></PageHeader
    >
    <div class="space-y-5 px-4 sm:px-6">
      <p
        v-if="preferences.storageError"
        class="rounded-xl border border-warn/20 bg-warn/5 p-4 text-xs text-warn"
        role="alert"
      >
        {{ preferences.storageError }}
      </p>
      <div class="grid items-start gap-5 xl:grid-cols-2">
        <section class="mh-card p-5">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <Palette class="size-4 text-accent" />{{ $t("外观与显示")
            }}<span class="ml-auto text-[10px] font-normal text-faint">{{
              $t("浏览器偏好 · 自动保存")
            }}</span>
          </h2>
          <div class="border-b border-line py-5">
            <p class="mb-3 text-xs text-soft">{{ $t("界面主题") }}</p>
            <el-segmented
              :model-value="currentTheme"
              :options="[...themeOptions]"
              :aria-label="$t('界面主题')"
              block
              @change="changeTheme($event as ThemeMode)"
            >
              <template #default="{ item }">
                <span class="flex items-center justify-center gap-2 py-2">
                  <component :is="item.icon" class="size-4" />{{
                    $t(item.label)
                  }}
                </span>
              </template>
            </el-segmented>
          </div>
          <div
            class="flex items-center justify-between gap-4 border-b border-line py-4"
          >
            <span class="text-sm">{{ $t("界面语言") }}</span>
            <LocaleSwitcher />
          </div>
          <div
            class="flex items-center justify-between gap-4 border-b border-line py-4"
          >
            <label for="preferred-view" class="text-sm">{{
              $t("默认展示方式")
            }}</label
            ><el-select
              id="preferred-view"
              v-model="preferences.values.viewMode"
              class="!w-36"
            >
              <el-option value="grid" :label="$t('瀑布流')" />
              <el-option value="list" :label="$t('列表')" />
            </el-select>
          </div>
          <SettingRow
            :title="$t('始终显示文件名称')"
            :description="$t('在图片卡片底部显示名称与标签，无需鼠标悬停。')"
            :checked="preferences.values.showNames"
            @change="preferences.values.showNames = $event"
          /><SettingRow
            :title="$t('紧凑瀑布流')"
            :description="$t('大屏显示更多列，适合快速浏览大量图片。')"
            :checked="preferences.values.denseGrid"
            @change="preferences.values.denseGrid = $event"
          /><SettingRow
            :title="$t('界面动画')"
            :description="
              $t('启用卡片与抽屉过渡；同时尊重系统的减弱动态效果设置。')
            "
            :checked="preferences.values.animations"
            @change="preferences.values.animations = $event"
          />
        </section>
        <div class="space-y-5">
          <section class="mh-card p-5">
            <h2 class="flex items-center gap-2 text-sm font-semibold">
              <Settings2 class="size-4 text-accent" />{{ $t("浏览与更新") }}
            </h2>
            <SettingRow
              :title="$t('自动刷新任务与统计')"
              :description="
                $t(
                  '任务首页每 10 秒、侧栏统计每 30 秒更新，后台标签页暂停轮询。关闭不影响服务器处理。',
                )
              "
              :checked="preferences.values.autoRefresh"
              @change="preferences.values.autoRefresh = $event"
            />
            <p class="pt-1 text-[11px] leading-6 text-faint">
              {{
                $t(
                  "这些偏好保存在当前浏览器，按账户隔离；主题为浏览器共享。不上传到服务器，也不会改变处理队列配置。",
                )
              }}
            </p>
          </section>
          <section class="mh-card p-5">
            <h2 class="mb-4 flex items-center gap-2 text-sm font-semibold">
              <HardDrive class="size-4 text-accent" />{{ $t("存储与上传")
              }}<span class="ml-auto text-[10px] font-normal text-faint">{{
                $t("服务器能力 · 只读")
              }}</span>
            </h2>
            <dl class="space-y-3 text-xs">
              <div class="flex justify-between gap-3">
                <dt class="text-soft">{{ $t("存储提供器") }}</dt>
                <dd>{{ capabilities?.storageProvider ?? "—" }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-soft">{{ $t("图库原文件") }}</dt>
                <dd>{{ formatBytes(workspace.overview?.bytes) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-soft">{{ $t("回收站原文件") }}</dt>
                <dd>{{ formatBytes(workspace.overview?.trashBytes) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-soft">{{ $t("单张图片上传上限") }}</dt>
                <dd>{{ formatBytes(capabilities?.upload.imageMaxBytes) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-soft">{{ $t("单个视频上传上限") }}</dt>
                <dd>{{ formatBytes(capabilities?.upload.videoMaxBytes) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-soft">{{ $t("视频时长上限") }}</dt>
                <dd>
                  {{
                    capabilities
                      ? $t("{value1} 小时", {
                          value1:
                            capabilities.upload.videoMaxDurationMs / 3600000,
                        })
                      : "—"
                  }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-soft">{{ $t("动图帧数上限") }}</dt>
                <dd>
                  {{
                    capabilities
                      ? $t("{value1} 帧", {
                          value1: capabilities.upload.maxFrames,
                        })
                      : "—"
                  }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-soft">{{ $t("单帧像素上限") }}</dt>
                <dd>
                  {{
                    capabilities
                      ? $t("{value1} 万像素", {
                          value1: (
                            capabilities.upload.maxPixels / 10000
                          ).toLocaleString(),
                        })
                      : "—"
                  }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-soft">{{ $t("回收站自动清理") }}</dt>
                <dd>
                  {{
                    capabilities
                      ? capabilities.trashRetentionDays === null
                        ? $t("未启用")
                        : $t("{value1} 天", {
                            value1: capabilities.trashRetentionDays,
                          })
                      : "—"
                  }}
                </dd>
              </div>
            </dl>
            <p class="mt-4 text-[11px] leading-6 text-faint">
              {{
                $t(
                  "不包含缩略图、兼容视频预览及其他用户数据。存储路径与服务器容量需由部署环境管理。",
                )
              }}
            </p>
          </section>
        </div>
      </div>
      <section class="mh-card p-5">
        <div class="flex items-center justify-between gap-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck class="size-4 text-ai" />{{ $t("媒体处理与扩展") }}
          </h2>
          <RouterLink
            :to="{ name: 'plugins' }"
            class="flex items-center gap-1 text-xs text-ai"
            ><Puzzle class="size-3.5" />{{ $t("查看能力清单") }}</RouterLink
          >
        </div>
        <p v-if="capabilitiesError" class="mt-3 text-xs text-err" role="alert">
          {{ capabilitiesError }}
          <button type="button" class="underline" @click="refresh">
            {{ $t("重试") }}
          </button>
        </p>
        <div class="grid gap-x-8 lg:grid-cols-2">
          <SettingRow
            :title="$t('上传后生成缩略图、EXIF 或视频预览')"
            :description="
              capabilities
                ? $t('后端内置流程，不支持在网页关闭。')
                : $t('正在获取服务器能力，不代表已启用。')
            "
            :checked="builtin.has('thumbnails')"
            disabled
          /><SettingRow
            :title="$t('AI 自动描述与标签')"
            :description="$t('未接入图像描述模型，当前使用手动标签。')"
            :checked="builtin.has('caption')"
            disabled
          /><SettingRow
            :title="$t('自动人脸识别')"
            :description="$t('自动识别尚未接入，可在人物页手动归类。')"
            :checked="builtin.has('face')"
            disabled
          /><SettingRow
            :title="$t('自动备份')"
            :description="$t('没有备份调度接口，请在部署环境备份数据。')"
            :checked="builtin.has('backup')"
            disabled
          />
        </div>
      </section>
      <section
        id="account"
        ref="accountSection"
        class="mh-card scroll-mt-5 p-5"
      >
        <h2 class="flex items-center gap-2 text-sm font-semibold">
          <UserRound class="size-4 text-accent" />{{ $t("账户与安全") }}
        </h2>
        <div class="mt-5 flex flex-col justify-between gap-6 lg:flex-row">
          <div class="flex min-w-0 items-start gap-4">
            <span
              class="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent/20 to-ai/20 text-xl font-semibold"
              >{{ auth.user?.username?.slice(0, 1) || $t("我") }}</span
            >
            <dl class="min-w-0 space-y-2 text-xs">
              <div class="flex gap-4">
                <dt class="shrink-0 text-faint">{{ $t("昵称") }}</dt>
                <dd class="break-all">{{ auth.user?.username }}</dd>
              </div>
              <div class="flex gap-4">
                <dt class="shrink-0 text-faint">{{ $t("邮箱") }}</dt>
                <dd class="break-all text-soft">{{ auth.user?.email }}</dd>
              </div>
              <div class="flex gap-4">
                <dt class="shrink-0 text-faint">{{ $t("角色") }}</dt>
                <dd class="text-soft">{{ auth.user?.roles }}</dd>
              </div>
            </dl>
          </div>
          <div class="flex flex-wrap items-start gap-2">
            <RouterLink
              :to="{
                name: 'forgot-password',
                query: { email: auth.user?.email },
              }"
              class="mh-button"
              ><KeyRound />{{ $t("重置密码") }}</RouterLink
            ><el-button
              :loading="signingOut === 'current'"
              native-type="button"
              :disabled="Boolean(signingOut)"
              @click="logout(false)"
            >
              <LogOut v-if="!(signingOut === 'current')" />{{
                $t("退出当前设备")
              }}</el-button
            ><el-button
              type="danger"
              plain
              :loading="signingOut === 'all'"
              native-type="button"
              :disabled="Boolean(signingOut)"
              @click="logout(true)"
              >{{ $t("退出所有设备") }}</el-button
            >
          </div>
        </div>
        <details class="mt-5 border-t border-line pt-4">
          <summary class="text-xs text-soft">
            {{
              $t("查看账户权限（{value1}）", {
                value1: auth.user?.permissions.length ?? 0,
              })
            }}
          </summary>
          <div class="mt-3 flex flex-wrap gap-2">
            <code
              v-for="permission in auth.user?.permissions"
              :key="permission"
              class="rounded bg-panel2 px-2 py-1 text-[10px] text-faint"
              >{{ permission }}</code
            >
          </div>
        </details>
        <p class="mt-4 text-[11px] leading-6 text-faint">
          {{
            $t(
              "账户信息来自登录接口，当前页面不提供昵称、邮箱或权限编辑。重置密码后旧会话将失效，所有设备退出会撤销服务端会话。",
            )
          }}
        </p>
      </section>
    </div>
  </section>
</template>
