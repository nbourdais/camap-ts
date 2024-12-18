import { Alert, Box } from '@mui/material';
import React from 'react';
import { CatalogType } from '../../gql';
import { useCamapTranslation } from '../../utils/hooks/use-camap-translation';
import { CsaCatalogContext } from './CsaCatalog.context';
import CsaCatalogAbsences from './containers/CsaCatalogAbsences';
import CsaCatalogDefaultOrder from './containers/CsaCatalogDefaultOrder';
import CsaCatalogOrders from './containers/CsaCatalogOrders';
import CsaCatalogPresentation from './containers/CsaCatalogPresentation';
import CsaCatalogSubscription from './containers/CsaCatalogSubscription';
import { restCsaCatalogTypeToType } from './interfaces';
import {
  useRestCheckSubscriptionDefaultOrderPost,
  useRestSubscriptionPost,
  useRestUpdateSubscriptionDefaultOrderPost,
  useRestUpdateSubscriptionOrdersPost,
} from './requests';

interface CsaCatalogRouterProps {
  userId: number;
}

const CsaCatalogRouter = ({ userId }: CsaCatalogRouterProps) => {
  const { t } = useCamapTranslation({
    t: 'csa-catalog',
  });
  const {
    catalogId,
    subscription,
    catalog,
    updatedOrders,
    distributions,
    absenceDistributionsIds,
    setSubscription,
    defaultOrder,
    initialSubscriptionId,
    error: contextError,
    adminMode,
  } = React.useContext(CsaCatalogContext);

  const [showPresentation, setShowPresentation] = React.useState(
    !initialSubscriptionId,
  );
  const [showAbsences, setShowAbsences] = React.useState(false);
  const [showDefaultOrder, setShowDefaultOrder] = React.useState(false);
  const [showOrders, setShowOrders] = React.useState(!!initialSubscriptionId);

  const isConstOrders = React.useMemo(() => {
    if (!catalog) return;
    return (
      restCsaCatalogTypeToType(catalog.type) === CatalogType.TYPE_CONSTORDERS
    );
  }, [catalog]);

  const [
    createSubscription,
    { data: subscriptionData, error: postSubscriptionError },
  ] = useRestSubscriptionPost();
  const [
    updateSubscriptionOrders,
    { data: updatedSubscriptionData, error: updatedSubscriptionError },
  ] = useRestUpdateSubscriptionOrdersPost();
  const [
    updateSubscriptionDefaultOrder,
    { data: updatedDefaultOrderData, error: updateDefaultOrderError },
  ] = useRestUpdateSubscriptionDefaultOrderPost();
  const [checkSubscriptionDefaultOrder, { error: checkDefaultOrderError }] =
    useRestCheckSubscriptionDefaultOrderPost(catalogId);

  React.useEffect(() => {
    if (
      !postSubscriptionError &&
      !updatedSubscriptionError &&
      !contextError &&
      !updateDefaultOrderError
    )
      return;

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [
    updatedSubscriptionError,
    postSubscriptionError,
    updateDefaultOrderError,
    contextError,
  ]);

  React.useEffect(() => {
    setSubscription(updatedSubscriptionData);
  }, [updatedSubscriptionData, setSubscription]);

  React.useEffect(() => {
    setSubscription(updatedDefaultOrderData);
  }, [updatedDefaultOrderData, setSubscription]);

  const onPresentationNext = () => {
    if (!showPresentation) return;
    setShowPresentation(false);
    setShowOrders(false);
    if (!isConstOrders && catalog?.distribMinOrdersTotal === 0) {
      onDefaultOrderNext();
    } else {
      setShowDefaultOrder(true);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onDefaultOrderNext = async () => {
    setShowPresentation(false);
    setShowOrders(false);
    setShowDefaultOrder(false);
    if (catalog && !catalog.absentDistribsMaxNb) {
      onAbsencesNext();
    } else {
      setShowAbsences(true);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const checkDefaultOrderAndContinue = async () => {
    const checkDefaultOrderData = await checkSubscriptionDefaultOrder(
      Object.keys(defaultOrder).map((productId) => {
        const productIdNumber = parseInt(productId, 10);
        const product = catalog!.products.find((p) => p.id === productIdNumber);
        return {
          productId: productIdNumber,
          quantity: defaultOrder[productIdNumber],
          productPrice: product!.price,
        };
      }),
    );

    if (!checkDefaultOrderData) return;

    onDefaultOrderNext();
  };

  const onAbsencesNext = async () => {
    const subscriptionSucceeded = await createSubscription({
      userId,
      catalogId,
      defaultOrder: Object.keys(defaultOrder).map((productId) => ({
        productId: parseInt(productId, 10),
        quantity: defaultOrder[parseInt(productId, 10)],
      })),
      absentDistribIds: absenceDistributionsIds as number[] | null,
    });

    if (!subscriptionSucceeded) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setShowPresentation(false);
    setShowAbsences(false);
    setShowDefaultOrder(false);
    setShowOrders(true);
  };

  React.useEffect(() => {
    setSubscription(subscriptionData);
  }, [subscriptionData, setSubscription]);

  const onOrderNext = async () => {
    if (!showOrders || !subscription || !catalog) return false;
    let success = false;
    if (isConstOrders) {
      success = await updateSubscriptionDefaultOrder(
        Object.keys(defaultOrder).map((productId) => ({
          productId: parseInt(productId, 10),
          quantity: defaultOrder[parseInt(productId, 10)],
        })),
        `${subscription.id}`,
      );
    } else {
      if (Object.keys(updatedOrders).length === 0) {
        return true;
      }

      success = await updateSubscriptionOrders(
        {
          distributions: distributions
            .filter((d) => {
              // in admin mode, this variable is set after the admin has set / unset absences
              // but we still want to update orders, so we ignore this
              if (absenceDistributionsIds && !adminMode) {
                return !absenceDistributionsIds.includes(d.id);
              }
              // return only updated orders on all distributions
              return !!updatedOrders[d.id];
            })
            .map((d) => ({
              // transform in expected API format
              id: d.id,
              orders: Object.keys(updatedOrders[d.id]).map((p) => ({
                productId: parseInt(p, 10),
                qty: updatedOrders[d.id][parseInt(p, 10)],
              })),
            })),
        },
        `${subscription.id}`,
      );
    }

    return success;
  };

  const error =
    updatedSubscriptionError ||
    postSubscriptionError ||
    contextError ||
    updateDefaultOrderError ||
    checkDefaultOrderError;

  return (
    <>
      {error && (
        <Box mb={2}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {subscriptionData && (
        <Box mb={2}>
          <Alert severity="success">
            {t('yourSubscriptionHasBeenCreated')}
          </Alert>
        </Box>
      )}

      {showPresentation && (
        <CsaCatalogPresentation onNext={onPresentationNext} />
      )}
      {showDefaultOrder && (
        <Box
          width={{
            xs: '100%',
            sm: '75%',
            md: '50%',
          }}
          mx="auto"
        >
          <CsaCatalogDefaultOrder onNext={checkDefaultOrderAndContinue} />
        </Box>
      )}
      {showAbsences && <CsaCatalogAbsences onNext={onAbsencesNext} />}
      {showOrders && catalog && (
        <>
          {isConstOrders ? (
            <CsaCatalogDefaultOrder onNext={onOrderNext} />
          ) : (
            <CsaCatalogOrders onNext={onOrderNext} adminMode={adminMode} />
          )}
        </>
      )}
      {showOrders && !!subscription && !adminMode && (
        <Box mt={3}>
          <CsaCatalogSubscription />
        </Box>
      )}
    </>
  );
};

export default CsaCatalogRouter;
