<template>
    <div>
        <base-header class="header pb-8 pt-5 pt-lg-8 d-flex align-items-center"
                     style="background-size: cover; background-position: center top;">

            <span class="mask bg-gradient-success opacity-8"></span>
        </base-header>
        <div class="container-fluid mt--7">
            <div class="row">
                <div class="col-xl-8 order-xl-1">
                    <card shadow type="secondary" class="mb-4">
                        <div slot="header" class="bg-white border-0">
                            <div class="row align-items-center">
                                <div class="col-8">
                                    <h3 class="mb-0">My account</h3>
                                </div>
                                <div class="col-4 text-right">
                                    <a href="#!" class="btn btn-md btn-primary">Submit Changes</a>
                                </div>
                            </div>
                        </div>
                        <template>
                            <form @submit.prevent>
                                <h6 class="heading-small text-muted mb-4">User information</h6>
                                <div class="pl-lg-4">
                                    <div class="row">
                                        <div class="col-lg-6">
                                            <base-input alternative=""
                                                        label="Username"
                                                        placeholder="Username"
                                                        input-classes="form-control-alternative"
                                                        v-model="model.username"
                                            />
                                        </div>
                                        <div class="col-lg-6">
                                            <base-input alternative=""
                                                        label="Email address"
                                                        placeholder="jesse@example.com"
                                                        input-classes="form-control-alternative"
                                                        v-model="model.email"
                                            />
                                        </div>
                                    </div>
                                    <div class="row">
                                        <div class="col-lg-6">
                                            <base-input alternative=""
                                                        label="First name"
                                                        placeholder="First name"
                                                        input-classes="form-control-alternative"
                                                        v-model="model.firstName"
                                            />
                                        </div>
                                        <div class="col-lg-6">
                                            <base-input alternative=""
                                                        label="Last name"
                                                        placeholder="Last name"
                                                        input-classes="form-control-alternative"
                                                        v-model="model.lastName"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <hr class="my-4" />
                                <!-- Address -->
                                <h6 class="heading-small text-muted mb-4">Contact information</h6>
                                <div class="pl-lg-4">
                                    <div class="row">
                                        <div class="col-lg-4">
                                            <base-input alternative=""
                                                        label="Phone Number"
                                                        placeholder="Phone Number"
                                                        input-classes="form-control-alternative"
                                                        v-model="model.phone"
                                            />
                                        </div>
                                        <div class="col-lg-8">
                                            <base-input alternative=""
                                                        label="Address"
                                                        placeholder="Home Address"
                                                        input-classes="form-control-alternative"
                                                        v-model="model.address"
                                            />
                                        </div>
                                    </div>
                                    <div class="row">
                                        <div class="col-lg-4">
                                            <base-input alternative=""
                                                        label="City"
                                                        placeholder="City"
                                                        input-classes="form-control-alternative"
                                                        v-model="model.city"
                                            />
                                        </div>
                                        <div class="col-lg-4">
                                            <base-input alternative=""
                                                        label="Country"
                                                        placeholder="Country"
                                                        input-classes="form-control-alternative"
                                                        v-model="model.country"
                                            />
                                        </div>
                                        <div class="col-lg-4">
                                            <base-input alternative=""
                                                        label="Postal code"
                                                        placeholder="Postal code"
                                                        input-classes="form-control-alternative"
                                                        v-model="model.zipCode"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </template>
                    </card>
                </div>
                <div class="col-xl-4 order-xl-2 mb-5 mb-xl-0">
                    <!-- Security Card -->
                    <card shadow type="secondary" class="mb-4">
                        <div slot="header" class="bg-white border-0">
                            <div class="row align-items-center">
                                <div class="col-8">
                                    <h3 class="mb-0">Security</h3>
                                </div>
                            </div>
                        </div>
                        <!-- Password Management -->
                        <h6 class="heading-small text-muted mb-4">Password Management</h6>
                        <div class="pt-lg-4">
                            <div class="row">
                                <div class="col-lg-12 mb-1">
                                    <a href="#!" class="btn btn-md btn-primary">Reset Password</a>
                                </div>
                            </div>
                            <div class="row pt-lg-4">
                                <div class="col-lg-12">
                                    <a href="#!" class="btn btn-md btn-primary">Enable Multi-Factor Authentication</a>
                                </div>
                            </div>
                        </div>
                        <hr class="my-4" />
                        <!-- Linked Accounts-->
                        <h6 class="heading-small text-muted mb-4">Linked Accounts</h6>
                        <p class="mb-4">Link this account to any of the following third-party providers.</p>
                            <div class="row pt-lg-4">
                                <div class="col-lg-12">
                                    <a href="#" class="btn btn-md btn-neutral btn-icon">
                                        <span class="btn-inner--icon"><img src="img/icons/common/github.svg"></span>
                                        <span class="btn-inner--text">Github</span>
                                    </a>
                                    <a href="#" class="btn btn-md btn-neutral btn-icon">
                                        <span class="btn-inner--icon"><img src="img/icons/common/google.svg"></span>
                                        <span class="btn-inner--text">Google</span>
                                    </a>
                                </div>
                            </div>
                    </card>
                     <!-- The Dangerous Card -->
                    <card shadow type="secondary" class="mb-4 border-danger text-danger">
                        <div slot="header" class="bg-white border-0">
                            <div class="row align-items-center">
                                <div class="col-8">
                                    <h3 class="mb-0">Danger Zone</h3>
                                </div>
                            </div>
                        </div>
                        <!-- Delete Account -->
                        <h6 class="heading-small text-danger mb-4">Delete Account</h6>
                        <p class="mb-4">Once you delete your account, there is no going back. Please be certain.</p>
                        <div class="pt-lg-4">
                            <div class="row">
                                <div class="col-lg-12">
                                    <a href="#!" class="btn btn-md btn-danger">Delete Account</a>
                                </div>
                            </div>
                        </div>
                    </card>
                </div>
            </div>
        </div>
    </div>
</template>
<script>
  export default {
    name: 'user-profile',
    data() {
      return {
        model: {
          username: '',
          email: '',
          firstName: '',
          lastName: '',
          phone: '',
          address: '',
          city: '',
          country: '',
          zipCode: '',
        }
      }
    },
  };
</script>
<style></style>
