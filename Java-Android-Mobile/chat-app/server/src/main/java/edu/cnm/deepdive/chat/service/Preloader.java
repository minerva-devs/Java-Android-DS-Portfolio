package edu.cnm.deepdive.chat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import edu.cnm.deepdive.chat.model.dao.ChannelRepository;
import edu.cnm.deepdive.chat.model.entity.Channel;
import java.io.InputStream;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
@Profile("preload")
public class Preloader implements CommandLineRunner {

  private final ChannelRepository repository;

  @Autowired
  public Preloader(ChannelRepository repository) {
    this.repository = repository;
  }

  @Override
  public void run(String... args) throws Exception {
    ClassPathResource channelsResource = new ClassPathResource("preload/channels.json");
    try (InputStream input = channelsResource.getInputStream()) {
      ObjectMapper mapper = new ObjectMapper();
      Channel[] channels = mapper.readValue(input, Channel[].class);
      repository.saveAll(Arrays.stream(channels).toList());

    }
  }
}
