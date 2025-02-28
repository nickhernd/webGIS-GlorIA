crontab -e
# Añadir estas líneas:
0 1 * * * cd /ruta/a/tu/proyecto && python3 copernicus_data_collector.py
30 1 * * * cd /ruta/a/tu/proyecto && python3 netcdf_processor.py