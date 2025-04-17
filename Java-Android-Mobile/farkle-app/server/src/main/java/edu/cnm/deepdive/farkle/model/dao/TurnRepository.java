package edu.cnm.deepdive.farkle.model.dao;

import edu.cnm.deepdive.farkle.model.entity.Turn;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TurnRepository extends JpaRepository<Turn, Long> {

//  List<Turn> findByGame(Game game);

  // TODO: 3/20/25 Return a list(?) of turns, by user

}
