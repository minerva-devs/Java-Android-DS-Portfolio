-- Generated 2025-03-18 15:20:25-0700 for database version 1

CREATE TABLE IF NOT EXISTS `apod`
(
    `apod_id`
    INTEGER
    PRIMARY
    KEY
    AUTOINCREMENT
    NOT
    NULL,
    `title`
    TEXT
    NOT
    NULL
    COLLATE
    NOCASE,
    `description`
    TEXT
    COLLATE
    NOCASE,
    `date`
    INTEGER
    NOT
    NULL,
    `copyright`
    TEXT,
    `media_type`
    INTEGER
    NOT
    NULL,
    `low_def_url`
    TEXT
    NOT
    NULL,
    `high_def_url`
    TEXT,
    `location`
    TEXT,
    `is_favorite`
    INTEGER
    NOT
    NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `index_apod_date` ON `apod` (`date`);

CREATE INDEX IF NOT EXISTS `index_apod_title` ON `apod` (`title`);

CREATE INDEX IF NOT EXISTS `index_apod_media_type` ON `apod` (`media_type`);