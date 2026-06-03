const db = require('../db/models');

const getUniqueFilters = async (req, res) => {
  try {
    const uniqueCategories = await db.Product.distinct('categoryName');
    const uniqueColors = await db.Product.distinct('color');
    const uniqueBrands = await db.Product.distinct('brand');
    const uniqueSize = await db.Product.distinct('size');

    const uniqueStates = await db.SaleOrder.distinct('shippingAddressState');
    const uniqueSaleOrderStatus = await db.SaleOrder.distinct('saleOrderStatus');

    const citiesByStateRecords = await db.SaleOrder.aggregate([
      {
        $group: {
          _id: {
            state: '$shippingAddressState',
            city: '$shippingAddressCity',
          },
        },
      },
      {
        $project: {
          _id: 0,
          shippingAddressState: '$_id.state',
          shippingAddressCity: '$_id.city',
        },
      },
    ]);

    const stateCityMap = uniqueStates.reduce((map, state) => {
      if (state) {
        map.push({
          state: state,
          cities: citiesByStateRecords
            .filter((city) => city.shippingAddressState === state)
            .map((city) => city.shippingAddressCity)
            .filter(Boolean),
        });
      }
      return map;
    }, []);

    res.status(200).json({
      filter: [
        {
          name: 'Category',
          values: uniqueCategories.filter(Boolean),
        },
        {
          name: 'Colors',
          values: uniqueColors.filter(Boolean),
        },
        {
          name: 'Brands',
          values: uniqueBrands.filter(Boolean),
        },
        {
          name: 'Sizes',
          values: uniqueSize.filter(Boolean),
        },
        {
          name: 'Cities',
          values: stateCityMap,
        },
        {
          name: 'Order Status',
          values: uniqueSaleOrderStatus.filter(Boolean),
        },
      ],
    });
  } catch (error) {
    console.error('Error fetching filters:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = { getUniqueFilters };
