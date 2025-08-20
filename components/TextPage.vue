<template>
  <div>
    <div
      class="header"
      :class="{ show, mobile: getIsMobile, tablet: getIsTabletView }"
      :style="{ width: `${width}px`, top: `calc(50% - ${titleMargin}px)` }"
    >
      <div class="close">
        <button @click="closeProject">X</button>
      </div>
      <div class="title-wrapper">
        <h1 class="title">{{ page.title_en }}</h1>
        <br />
        <h2 class="subtitle" v-if="project.subtitle_en">
          {{ page.subtitle_en }}
        </h2>
      </div>
    </div>
    <!-- project -->
    <div class="project-wrapper" :class="{ show }">
      <div class="project-bg"></div>
      <div
        class="project"
        :class="{ mobile: getIsMobile, tablet: getIsTabletView }"
        :style="{
          width: `${width}px`,
          height: `${height}px`,
          top: `calc(50% - ${contentMargin}px)`,
        }"
      >
        <div class="content">
          <div class="side-content" v-if="!(getIsMobile || getIsTabletView)">
            <div
              v-if="project.details_en"
              class="details"
              v-html="renderDetails"
            ></div>
            <div class="tags">
              <h3>Tags:</h3>
              <ul>
                <li v-for="tag in project.tags" :key="tag">
                  <u>{{ tag }}</u>
                </li>
              </ul>
            </div>
          </div>
          <div class="image" :style="{ height: `${height}px` }">
            <img class="image-el" :src="project.thumbnail" alt="" />
          </div>
          <div class="description" v-html="renderContent"></div>
          <div class="gallery-images">
            <img
              class="gallery_image"
              v-for="(image, imageIndex) in imageGallery"
              :key="imageIndex"
              @click="onClickImage(imageIndex, image)"
              :src="image"
            />
          </div>
          <div
            v-if="getIsMobile || getIsTabletView"
            class="details"
            v-html="renderDetails"
          ></div>
        </div>
      </div>
    </div>
    <v-gallery
      :images="allImages"
      :index="curImageIndex"
      @close="curImageIndex = null"
    ></v-gallery>
  </div>
</template>