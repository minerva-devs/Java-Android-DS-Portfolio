package edu.cnm.deepdive.chat.configuration;


import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
@Profile("service")
public class SecurityConfiguration {

  //will convert from Jwt to something that abstracts authentication token: our bearer token.
  private final Converter<Jwt, ? extends AbstractAuthenticationToken> converter;
  private final String issuerUri;
  private final String clientId;


  //in Spring Beans we don't do @Inject, instead- @Autowired
  @Autowired
  public SecurityConfiguration
  (Converter<Jwt, ? extends AbstractAuthenticationToken> converter,
      @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuerUri,
      @Value("${spring.security.oauth2.resourceserver.jwt.client-id}") String clientId
  ) {
    this.converter = converter;
    this.issuerUri = issuerUri;
    this.clientId = clientId;
  }

  //this is our security chain, describes security policy
  //any incoming request will be stripped of its data and we won't return any data
  //request's authorization token will be compared
  @Bean
  public SecurityFilterChain provideFilterChain(HttpSecurity security) throws Exception {
    return security
        //lambda: when you're processing, ignore session cookies, will not maintain session information
        //if your pattern matches this URL request, you can be anonymous
        //but our security policy is that any request needs to be authenticated
        .sessionManagement((session) ->
            session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests((auth) -> auth.anyRequest().authenticated())
        .oauth2ResourceServer((oauth) ->
            oauth.jwt((jwt) -> jwt.jwtAuthenticationConverter(converter)))
        .build();
  }

//Decoder with multiple rules to evaluate at audience claim & claim issuer.
  //Each policy starts with OAuth2TokenValidator
  //Spring will look for some bean that has a decoder and bec we provided our own bean, Spring will compare against our bean
  @Bean
  public JwtDecoder provideDecoder() {
    NimbusJwtDecoder decoder = JwtDecoders.fromIssuerLocation(issuerUri);
    OAuth2TokenValidator<Jwt> audienceValidator =
        new JwtClaimValidator<List<String>>(JwtClaimNames.AUD, (aud) -> aud.contains(clientId));
    //the issuer of the bearer token
    OAuth2TokenValidator<Jwt> issuerValidator = JwtValidators.createDefaultWithIssuer(issuerUri);
    OAuth2TokenValidator<Jwt> combinedValidator =
        new DelegatingOAuth2TokenValidator<>(audienceValidator, issuerValidator);
    decoder.setJwtValidator(combinedValidator);
    return decoder;
  }



}
