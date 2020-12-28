-- put your schema here

DROP TABLE IF EXISTS Emails;
DROP TABLE IF EXISTS Templates;
DROP TABLE IF EXISTS Assets;

CREATE TABLE Emails (
    uuid        TEXT PRIMARY KEY,
    lastused    TEXT NOT NULL,
    body        TEXT NOT NULL,
    subject     TEXT NOT NULL,
    is_template INTEGER NOT NULL,

    UNIQUE(uuid)
);

CREATE TABLE Assets (
    url         TEXT NOT NULL,
    size        INT NOT NULL,
    name        TEXT PRIMARY KEY
);


