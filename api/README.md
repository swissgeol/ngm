# bedrock

## Requirements

* psql (postgresql-client)
* sqlx-cli
* docker

## Develop

Initialize the database by spawning a docker container with

```bash
./scripts/init_db.sh
```

## Database Migrations

Database migrations are managed using [sqlx-cli](https://github.com/launchbadge/sqlx/tree/master/sqlx-cli). Install with

```bash
cargo install sqlx-cli --no-default-features --features rustls,postgres
```