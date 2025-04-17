create sequence game_player_seq start with 1 increment by 50;
create sequence game_seq start with 1 increment by 50;
create sequence roll_seq start with 1 increment by 50;
create sequence turn_seq start with 1 increment by 50;
create sequence user_profile_seq start with 1 increment by 50;
create table game
(
    game_id      bigint                                 not null,
    winner_id    bigint,
    external_key uuid                                   not null unique,
    state        enum ('FINISHED','IN_PLAY','PRE_GAME') not null,
    primary key (game_id)
);
create table game_player
(
    game_id         bigint                      not null,
    game_player_id  bigint                      not null,
    joined_at       timestamp(6) with time zone not null,
    user_profile_id bigint                      not null,
    primary key (game_player_id),
    unique (game_id, user_profile_id)
);
create table roll
(
    farkle      boolean                     not null,
    number_dice integer                     not null,
    roll_score  integer,
    roll_id     bigint                      not null,
    rolled_at   timestamp(6) with time zone not null,
    turn_id     bigint                      not null,
    primary key (roll_id)
);
create table roll_die
(
    face_value    integer not null,
    scoring_group integer not null,
    roll_id       bigint  not null
);
create table turn
(
    finished     boolean                     not null,
    game_id      bigint                      not null,
    started_at   timestamp(6) with time zone not null,
    turn_id      bigint                      not null,
    user_id      bigint                      not null,
    external_key uuid                        not null unique,
    primary key (turn_id)
);
create table user_profile
(
    user_profile_id bigint not null,
    external_key    uuid   not null unique,
    auth_key        varchar(255),
    display_name    varchar(255),
    primary key (user_profile_id)
);
alter table if exists game
    add constraint FKn7s1942q5h1109lb8houdtbai foreign key (winner_id) references user_profile;
alter table if exists game_player
    add constraint FK8so14tnd5mqdjqabugc0cycxu foreign key (game_id) references game;
alter table if exists game_player
    add constraint FKlrv63161ntxv6dolgmlv32tc1 foreign key (user_profile_id) references user_profile;
alter table if exists roll
    add constraint FKk1f68rwaqf0c5w6brh6c59rlr foreign key (turn_id) references turn;
alter table if exists roll_die
    add constraint FK27uspo9bf2ahsy3dknypc02hs foreign key (roll_id) references roll;
alter table if exists turn
    add constraint FKfnda1g6jd92jpiakpu2689pgf foreign key (game_id) references game;
alter table if exists turn
    add constraint FKi3rn9e2enjeyqhdv9kmsgo6xh foreign key (user_id) references user_profile;
