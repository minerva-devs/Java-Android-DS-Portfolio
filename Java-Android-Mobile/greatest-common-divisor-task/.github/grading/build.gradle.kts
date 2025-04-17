/*
 *  Copyright 2025 CNM Ingenuity, Inc.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import org.gradle.api.tasks.testing.logging.TestLogEvent
import java.util.concurrent.atomic.AtomicReference

plugins {
    java
    jacoco
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(libs.versions.java.get())
    }
}

val solutionArtifactName = "${rootProject.name}-solution"

dependencies {
    testImplementation(libs.junit.aggregator)
    testRuntimeOnly(libs.junit.engine)
    testRuntimeOnly(libs.junit.platform)
    if (hasCredentials()) {
        testRuntimeOnly(
            "${project.property("group")}:${solutionArtifactName}:${
                stem(project.property("version") as String)
            }.+:tests"
        )
    }
}

tasks.register<Copy>("copyTests") {
    enabled = hasCredentials()
    val pattern = "^.*[/\\\\]${solutionArtifactName}-.*-tests.jar\$".toRegex()
    val jarFile = AtomicReference(file(".not.found.jar."))
    configurations.testRuntimeClasspath.get().forEach {
        if (pattern.matches(it.absolutePath)) {
            jarFile.set(it);
        }
    }
    from(zipTree(jarFile.get()))
    into("${projectDir}/.grading/")
}

tasks.compileTestJava {
    enabled = false
}

tasks.processTestResources {
    enabled = false
}

tasks.test {
    dependsOn(tasks.getByName("copyTests"))
    useJUnitPlatform()
    classpath -= testClassesDirs
    classpath -= files("${layout.buildDirectory}/resources/test")
    testClassesDirs = files("${projectDir}/.grading")
    classpath += files("${projectDir}/.grading")
    testLogging {
        events.addAll(setOf(TestLogEvent.FAILED, TestLogEvent.SKIPPED, TestLogEvent.PASSED))
    }
    finalizedBy(tasks.jacocoTestReport)
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
}

fun stem(version: String): String = version.substring(0, version.lastIndexOf("."))

fun hasCredentials(): Boolean = !(System.getenv("PACKAGE_CONSUMER_USER") ?: "").equals("")
        && !(System.getenv("PACKAGE_CONSUMER_TOKEN") ?: "").equals("")