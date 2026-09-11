<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MapPin, LocateFixed, RefreshCw, X } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { useRemoteData } from "@/composables/useRemoteData";
import { formatCoordinate } from "@/composables/mediaFormat";
import type { Place } from "@/types/media";
import PageHeader from "@/components/workspace/PageHeader.vue";
import DataState from "@/components/workspace/DataState.vue";
import AssetBrowser from "@/components/media/AssetBrowser.vue";

const route = useRoute();
const router = useRouter();
const { data, loading, error, refresh } = useRemoteData(mediaApi.places);
const selected = computed(() => {
  const value = route.query.place;
  if (typeof value !== "string" || !/^-?\d{1,4}:-?\d{1,4}$/.test(value))
    return null;
  const [latitudeCell, longitudeCell] = value.split(":").map(Number);
  if (
    latitudeCell === undefined ||
    longitudeCell === undefined ||
    latitudeCell < -900 ||
    latitudeCell > 900 ||
    longitudeCell < -1800 ||
    longitudeCell > 1800
  )
    return null;
  return {
    id: value,
    latitude: Math.min(90, (latitudeCell + 0.5) / 10),
    longitude: Math.min(180, (longitudeCell + 0.5) / 10),
  };
});
const markers = computed(() => data.value?.items.slice(0, 80) ?? []);
const bounds = computed(() => {
  const latitudes = markers.value.map((place) => place.latitude);
  const longitudes = markers.value.map((place) => place.longitude);
  const minLatitude = Math.min(...latitudes, selected.value?.latitude ?? 90);
  const maxLatitude = Math.max(...latitudes, selected.value?.latitude ?? -90);
  const minLongitude = Math.min(
    ...longitudes,
    selected.value?.longitude ?? 180,
  );
  const maxLongitude = Math.max(
    ...longitudes,
    selected.value?.longitude ?? -180,
  );
  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    height: Math.max(0.3, maxLatitude - minLatitude),
    width: Math.max(0.3, maxLongitude - minLongitude),
  };
});
function position(place: Place) {
  return {
    left: `${50 + ((place.longitude - bounds.value.longitude) / bounds.value.width) * 76}%`,
    top: `${50 - ((place.latitude - bounds.value.latitude) / bounds.value.height) * 65}%`,
  };
}
function select(id?: string) {
  void router.replace({ name: "places", query: id ? { place: id } : {} });
}
</script>

<template>
  <section>
    <PageHeader
      :title="$t('地点')"
      :description="
        data
          ? $t('{value1} 项带 GPS 的媒体 · {value2} 个坐标分组', {
              value1: data.locatedAssets,
              value2: data.totalPlaces,
            })
          : $t('用照片里的坐标，重新看见走过的地方')
      "
      ><el-button native-type="button" :disabled="loading" @click="refresh">
        <RefreshCw :class="{ 'animate-spin': loading }" />{{
          $t("刷新地点")
        }}</el-button
      ></PageHeader
    >
    <div class="px-4 sm:px-6">
      <div
        class="place-map relative min-h-[340px] overflow-hidden rounded-2xl border border-line bg-panel2"
      >
        <DataState
          v-if="loading || error || !data?.items.length"
          :loading="loading"
          :error="error"
          :icon="MapPin"
          :title="$t('还没有包含 GPS 的照片')"
          :description="
            $t('上传保留拍摄位置 EXIF 的原图，完成元数据提取后即可在这里查看。')
          "
          @retry="refresh"
        />
        <template v-else
          ><div
            class="pointer-events-none absolute inset-0 bg-radial from-ai/5 to-transparent"
          />
          <div
            class="absolute top-4 left-4 flex items-center gap-2 rounded-lg border border-line bg-panel/90 px-3 py-2 text-xs text-soft"
          >
            <LocateFixed class="size-4 text-ai" />{{ $t("GPS 分布示意") }}
          </div>
          <span class="absolute top-5 right-5 text-[10px] text-faint">{{
            $t("纬度 ↑ · 经度 →")
          }}</span>
          <button
            v-for="place in markers"
            :key="place.id"
            type="button"
            class="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-accent/40 bg-panel px-2.5 py-1.5 text-xs text-accent shadow-lg transition hover:z-10 hover:bg-accent hover:text-ink focus:z-10"
            :class="{ '!bg-accent !text-ink': selected?.id === place.id }"
            :style="position(place)"
            :aria-label="
              $t('{value1}，{value2} 项媒体', {
                value1: formatCoordinate(place.latitude, place.longitude),
                value2: place.count,
              })
            "
            :aria-pressed="selected?.id === place.id"
            @click="select(place.id)"
          >
            <MapPin class="size-3.5" />{{ place.count }}
          </button>
          <p
            class="absolute right-4 bottom-4 left-4 text-[10px] leading-5 text-faint"
          >
            {{
              $t(
                "按 0.1° 网格聚合 · 按坐标范围自适应，不是道路地图 · 概览显示数量最多的 {value1} 个分组",
                { value1: markers.length },
              )
            }}
          </p></template
        >
      </div>
      <p class="mt-3 text-[11px] leading-6 text-faint">
        {{
          $t(
            "仅使用照片中已有的经纬度，不向外部地图服务发送位置，不推断城市名称。{value1}",
            {
              value1:
                data && data.totalPlaces > data.items.length
                  ? $t("列表展示数量最多的 {value1} 个分组。", {
                      value1: data.items.length,
                    })
                  : "",
            },
          )
        }}
      </p>
      <div
        v-if="data?.items.length"
        class="my-5 flex max-h-40 flex-wrap gap-2 overflow-y-auto"
      >
        <button
          v-for="place in data.items"
          :key="place.id"
          type="button"
          class="mh-chip"
          :aria-pressed="selected?.id === place.id"
          @click="select(place.id)"
        >
          <MapPin class="size-3" />{{
            formatCoordinate(place.latitude, place.longitude)
          }}<span class="text-faint">{{ place.count }}</span>
        </button>
      </div>
    </div>
    <template v-if="selected"
      ><div class="mb-4 flex items-center justify-between gap-3 px-4 sm:px-6">
        <h2 class="text-sm font-semibold">
          {{
            $t("{value1} 附近的媒体", {
              value1: formatCoordinate(selected.latitude, selected.longitude),
            })
          }}
        </h2>
        <el-button native-type="button" @click="select()">
          <X />{{ $t("清除地点") }}</el-button
        >
      </div>
      <AssetBrowser
        :query="{ placeId: selected.id }"
        empty-title="该坐标分组暂无媒体"
        empty-description="照片可能已移入回收站，请刷新地点列表。"
    /></template>
  </section>
</template>

<style scoped>
.place-map {
  background-image:
    linear-gradient(var(--app-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--app-line) 1px, transparent 1px);
  background-size: 44px 44px;
}
</style>
