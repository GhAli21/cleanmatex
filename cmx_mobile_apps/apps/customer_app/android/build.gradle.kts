allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}
subprojects {
    fun forceWorkingNdk() {
        extensions.findByName("android")?.let { androidExtension ->
            androidExtension.javaClass.methods
                .firstOrNull { method -> method.name == "setNdkVersion" && method.parameterCount == 1 }
                ?.invoke(androidExtension, "30.0.14904198")
        }
    }

    pluginManager.withPlugin("com.android.application") {
        forceWorkingNdk()
    }

    pluginManager.withPlugin("com.android.library") {
        forceWorkingNdk()
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
