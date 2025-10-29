-- Grant permissions for regnum_user to connect from any host
GRANT ALL PRIVILEGES ON regnum_db.* TO 'regnum_user'@'%' IDENTIFIED BY 'regnum_password';
FLUSH PRIVILEGES;