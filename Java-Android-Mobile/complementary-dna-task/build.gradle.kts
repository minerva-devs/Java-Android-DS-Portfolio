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

plugins {
    java
    jacoco
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(libs.versions.java.get())
    }
}

dependencies {
    testImplementation(libs.junit.aggregator)
    testRuntimeOnly(libs.junit.engine)
    testRuntimeOnly(libs.junit.platform)
}

tasks.javadoc {
    with(options as StandardJavadocDocletOptions) {
        links("https://docs.oracle.com/en/java/javase/${libs.versions.java.get()}/docs/api/")
    }
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        events.addAll(setOf(TestLogEvent.FAILED, TestLogEvent.SKIPPED, TestLogEvent.PASSED))
    }
    finalizedBy(tasks.jacocoTestReport)
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
}
