import { computed, observable } from "mobx";
import { createTransformer } from "mobx-utils";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Color from "terriajs-cesium/Source/Core/Color";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import DataSource from "terriajs-cesium/Source/DataSources/DataSource";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import PointGraphics from "terriajs-cesium/Source/DataSources/PointGraphics";
import Constructor from "../Core/Constructor";
import filterOutUndefined from "../Core/filterOutUndefined";
import createFlattenedStrataView from "../Models/createFlattenedStrataView";
import FlattenedFromTraits from "../Models/FlattenedFromTraits";
import { ImageryParts } from "../Models/Mappable";
import Model from "../Models/Model";
import ModelPropertiesFromTraits from "../Models/ModelPropertiesFromTraits";
import TableColumn from "../Table/TableColumn";
import TableColumnType from "../Table/TableColumnType";
import TableStyleTraits from "../Traits/TableStyleTraits";
import TableTraits from "../Traits/TableTraits";
import TableStyle from "../Table/TableStyle";

export default function TableMixin<T extends Constructor<Model<TableTraits>>>(
  Base: T
) {
  abstract class TableMixin extends Base {
    /**
     * The raw data table in column-major format, i.e. the outer array is an
     * array of columns.
     */
    @observable
    dataColumnMajor: string[][] | undefined;

    @computed
    get tableColumns(): readonly TableColumn[] {
      if (this.dataColumnMajor === undefined) {
        return [];
      }

      return this.dataColumnMajor.map((_, i) => this.getTableColumn(i));
    }

    @computed
    get tableStyles(): TableStyle[] {
      return this.stylesWithDefaults.map((_, i) => this.getTableStyle(i));
    }

    @computed
    get selectedStyle(): string | undefined {
      const value = super.selectedStyle;
      if (value !== undefined) {
        return value;
      } else if (this.styles && this.styles.length > 0) {
        return this.styles[0].id;
      }
      return undefined;
    }

    @computed
    get mapItems(): (DataSource | ImageryParts)[] {
      const result: (DataSource | ImageryParts)[] = [];

      const styles = this.tableStyles;
      if (this.selectedStyle === undefined) {
        return result;
      }

      const style = styles.find(style => style.id === this.selectedStyle);
      if (style === undefined) {
        return result;
      }

      return filterOutUndefined([
        this.createLongitudeLatitudeDataSource(style)
      ]);
    }

    private readonly createLongitudeLatitudeDataSource = createTransformer(
      (style: TableStyle): DataSource | undefined => {
        if (!style.isPoints()) {
          return undefined;
        }

        const longitudes = style.longitudeColumn.valuesAsNumbers.values;
        const latitudes = style.latitudeColumn.valuesAsNumbers.values;

        const colorColumnName = style.colorTraits.colorColumn
        const colorColumn = colorColumnName ? this.findColumnByName(colorColumnName) : undefined;

        const dataSource = new CustomDataSource(this.name || "CsvCatalogItem");

        dataSource.entities.suspendEvents();

        for (let i = 0; i < longitudes.length && i < latitudes.length; ++i) {
          const longitude = longitudes[i];
          const latitude = latitudes[i];
          if (longitude === null || latitude === null) {
            continue;
          }

          dataSource.entities.add(
            new Entity({
              position: Cartesian3.fromDegrees(longitude, latitude, 0.0),
              point: new PointGraphics({
                color: Color.RED,
                pixelSize: 5
              })
            })
          );
        }

        dataSource.entities.resumeEvents();

        return dataSource;
      }
    );

    @computed
    get stylesWithDefaults(): readonly FlattenedFromTraits<TableStyleTraits>[] {
      const styles = this.styles || [];
      const defaultStyle:
        | ModelPropertiesFromTraits<TableStyleTraits>
        | undefined = this.defaultStyle;
      if (defaultStyle === undefined) {
        return styles;
      }

      return styles.map(style => {
        const model = {
          id: style.id + ":with-defaults",
          strataTopToBottom: [style, defaultStyle]
        };
        return createFlattenedStrataView(model, TableStyleTraits);
      });
    }

    findFirstColumnByType(type: TableColumnType): TableColumn | undefined {
      return this.tableColumns.find(column => column.type === type);
    }

    findColumnByName(name: string): TableColumn | undefined {
      return this.tableColumns.find(column => column.name === name);
    }

    private readonly getTableColumn = createTransformer((index: number) => {
      return new TableColumn(this, index);
    });

    private readonly getTableStyle = createTransformer((index: number) => {
      return new TableStyle(this, index);
    });
  }

  return TableMixin;
}
