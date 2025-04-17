plugins {
    java
    alias(libs.plugins.spring.boot)
    alias(libs.plugins.spring.dependency)
    alias(libs.plugins.asciidoctor.convert)
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(libs.versions.java.get())
    }
}

tasks.javadoc {

    title = "${project.property("appName")} server ${project.property("version")}"
    setDestinationDir(projectDir.toPath().resolve("../docs/api/server").toFile())

    with(options as StandardJavadocDocletOptions) {
        windowTitle = docTitle
        memberLevel = JavadocMemberLevel.PROTECTED
        isLinkSource = true
        isAuthor = false
        links(
            "https://docs.oracle.com/en/java/javase/${libs.versions.java.get()}/docs/api/",
            // TODO Modify or add to this list for the specific libraries used.
            "https://docs.spring.io/spring-framework/docs/current/javadoc-api/",
            "https://docs.spring.io/spring-boot/api/java/",
            "https://docs.spring.io/spring-hateoas/docs/current/api/",
            "https://docs.spring.io/spring-data/commons/docs/current/api/",
            "https://docs.spring.io/spring-data/data-jpa/docs/current/api/",
            "https://docs.spring.io/spring-security/site/docs/current/api/",
            "https://docs.jboss.org/hibernate/orm/current/javadocs/",
            "https://javadoc.io/doc/com.fasterxml.jackson.core/jackson-core/latest/",
            "https://javadoc.io/doc/com.fasterxml.jackson.core/jackson-databind/latest/",
            "https://javadoc.io/doc/com.fasterxml.jackson.core/jackson-annotations/latest/",
            "https://javadoc.io/doc/com.fasterxml.jackson.datatype/jackson-datatype-jdk8/latest/",
            "https://javadoc.io/doc/com.fasterxml.jackson.datatype/jackson-datatype-jsr310/latest/"
        )
        addBooleanOption("html5", true)
        addStringOption("Xdoclint:none", "-quiet")
    }

    isFailOnError = true

}

configurations {
    compileOnly {
        extendsFrom(configurations.annotationProcessor.get())
    }
}

extra["snippetsDir"] = file("build/generated-snippets")

dependencies {
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.hateoas)
    implementation(libs.spring.boot.oauth2.resource.server)
    implementation(libs.spring.boot.starter.security)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.web)
    runtimeOnly(libs.h2)
    annotationProcessor(libs.spring.boot.configuration.processor)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.restdocs.mockmvc)
    testImplementation(libs.spring.security.test)
    testRuntimeOnly(libs.junit.platform.launcher)
}

tasks.withType<Test> {
    useJUnitPlatform()
}

tasks.test {
    outputs.dir(project.extra["snippetsDir"]!!)
}

tasks.asciidoctor {
    inputs.dir(project.extra["snippetsDir"]!!)
    dependsOn(tasks.test)
}
