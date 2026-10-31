plugins {
    id("com.android.application")
}

// O endereço do jogo vem de GAME_URL em gradle.properties.
val gameUrl = (project.findProperty("GAME_URL") as String?) ?: "https://play.useconectai.com.br/"

// A tela de manutenção é a da raiz do projeto (manutencao.html); o build copia para os assets do app.
val copyMaintenance by tasks.registering(Copy::class) {
    from(rootProject.file("../manutencao.html"))
    into(layout.projectDirectory.dir("src/main/assets"))
}
tasks.named("preBuild") { dependsOn(copyMaintenance) }

android {
    namespace = "com.dayvison.mossblade"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.dayvison.mossblade"
        minSdk = 29
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "GAME_URL", "\"$gameUrl\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
}
