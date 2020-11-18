<template>
  <footer class="footer px-4">
    <div class="row align-items-center justify-content-lg-between">
      <div class="col-lg-6">
        <div class="copyright text-center text-lg-left text-muted">
          <a href="https://imageengine.io/" class="font-weight-bold mr-1" target="_blank">ImageEngine</a>by<a href="https://www.scientiamobile.com/" class="font-weight-bold ml-1" target="_blank">ScientiaMobile</a> © {{year}}
        </div>
      </div>
      <!-- <div class="col-lg-6">
        <ul class="nav nav-footer justify-content-center justify-content-lg-end">
          <li class="nav-item">
            <a href="https://imageengine.io/" class="nav-link" target="_blank">About ImageEngine</a>
          </li>
          <li class="nav-item">
            <a href="https://imageengine.io/docs/setup/overview" class="nav-link" target="_blank">Documentation</a>
          </li>
          <li class="nav-item">
            <a href="https://imageengine.io/blog" class="nav-link" target="_blank">Blog</a>
          </li>
          <li class="nav-item">
            <a href="hhttps://imageengine.io/contact" class="nav-link" target="_blank">Contact Us</a>
          </li>
        </ul>
      </div> -->
    </div>
  </footer>
</template>
<script>
export default {
  data() {
    return {
      year: new Date().getFullYear()
    };
  }
};
</script>
<style></style>
