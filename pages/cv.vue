<template>
  <div>
    <CvPage @closeProject="onCloseProject" :data="data" />
  </div>
</template>

<script>
import CvPage from "~/components/CvPage.vue";

export default {
  name: "Cv",
  components: {
    CvPage,
  },
  head() {
    return {
      title: "cv – alberto harres",
      meta: [
        {
          hid: "description",
          name: "description",
          content:
            "Curriculum vitae of Alberto Harres: education, work experience, research, exhibitions, workshops, awards, press and skills.",
        },
      ],
    };
  },
  async asyncData({ payload }) {
    if (payload)
      return {
        data: payload,
      };
    else
      return {
        data: await require(`~/assets/content/site/cv.json`),
      };
  },
  data() {
    return {
      data: null,
    };
  },
  methods: {
    onCloseProject() {
      this.$router.push({ path: "/works" });
    },
  },
};
</script>
