package edu.cnm.deepdive.chat.service;

import edu.cnm.deepdive.chat.model.entity.User;
import java.util.Collection;
import java.util.Collections;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.stereotype.Service;

@Service
public class UserConverter implements Converter<Jwt, UsernamePasswordAuthenticationToken> {

  private final AbstractUserService userService;

  //create Spring bean for userService in abstract method
  @Autowired
  public UserConverter(AbstractUserService userService) {
    this.userService = userService;
  }

  //converter
  @Override
  public UsernamePasswordAuthenticationToken convert(Jwt source) {
    Collection<SimpleGrantedAuthority> grants =
        Collections.singleton(new SimpleGrantedAuthority("ROLE_USER"));
    //this will implement abstract userService
    User user = userService.getOrCreate(source.getSubject(), source.getClaimAsString("name"));
    return new UsernamePasswordAuthenticationToken(user, source.getTokenValue(), grants);

  }
}
