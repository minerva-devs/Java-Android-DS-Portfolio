package edu.cnm.deepdive.farkle.model.dao;

import edu.cnm.deepdive.farkle.model.entity.Game;
import edu.cnm.deepdive.farkle.model.entity.State;
import edu.cnm.deepdive.farkle.model.entity.User;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface GameRepository extends JpaRepository<Game, Long> {

//  List<Game> findByUser(User user);

  @Query("""
      SELECT g
      FROM Game AS g
      JOIN g.players AS p
      WHERE g.state IN :states AND p.user = :player
      """)
  Optional<Game> findByPlayersContainsAndStateIn(User player, Set<State> states);


  @Query("""
      SELECT g
      FROM Game AS g
      JOIN g.players AS p
      JOIN p.user AS u
      WHERE g.externalKey = :externalKey AND u = :user
      """)
  Optional<Game> findByExternalKeyAndPlayersUserContains(UUID externalKey, User user);

  @Query(value = """
      SELECT g.state != :stateName
                 OR COALESCE(g.roll_count, 0) != :rollCount
      FROM (SELECT
                   g.state,
                   SUM(r.roll_count) AS roll_count
            FROM game AS g
                      JOIN game_player AS gp
                        ON gp.game_id = g.game_id
                     LEFT JOIN turn AS t
                          ON t.game_id = g.game_id
                     LEFT JOIN (SELECT r.turn_id,
                                  COUNT(*) AS roll_count
                           FROM roll AS r
                           GROUP BY r.turn_id) AS r
                          ON r.turn_id = t.turn_id
            WHERE g.external_key = :gameKey
                  AND gp.user_profile_id = :userId) AS g
      """, nativeQuery = true)
  List<Boolean> checkForUpdates(UUID gameKey, long userId, String stateName, int rollCount,
      Pageable pageable);

  Optional<Game> findByState(State state);
}